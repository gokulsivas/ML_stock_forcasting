# backend/services/prediction_service.py

import os
import sys
sys.path.append('..')

import torch
import numpy as np
import joblib
import pandas as pd
from datetime import datetime, timedelta, date
from sklearn.preprocessing import StandardScaler

from models.hybrid_lstm_gru import HybridLSTMGRU
from data.data_loader import StockDataLoader


class PredictionService:
    """Handle model inference — LSTM + optional XGBoost/CNN1D ensemble"""

    def __init__(self, model_path='saved_models/returns_model.pth'):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Loading model on device: {self.device}")

        # ── Feature columns ───────────────────────────────────────────────────
        self.feature_cols = joblib.load('saved_models/returns_feature_cols.pkl')
        input_size        = len(self.feature_cols)

        # ── LSTM: handle both flat state_dict (old) and full checkpoint (new) ──
        checkpoint = torch.load(model_path, map_location=self.device)
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            cfg                  = checkpoint.get('config', {})
            input_size           = cfg.get('input_size',      input_size)
            hidden_size          = cfg.get('hidden_size',     256)
            num_layers           = cfg.get('num_layers',      3)
            dropout              = cfg.get('dropout',         0.4)
            self.sequence_length = cfg.get('sequence_length', 20)
            state_dict           = checkpoint['model_state_dict']
        else:
            hidden_size, num_layers, dropout = 128, 2, 0.2
            self.sequence_length = 20
            state_dict           = checkpoint

        self.model = HybridLSTMGRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout
        )
        self.model.load_state_dict(state_dict)
        self.model.to(self.device).eval()

        # ── Ensemble models (optional) ────────────────────────────────────────
        self.xgb_model    = None
        self.cnn_model    = None
        self.meta_learner = None
        self._load_ensemble()

        self.data_loader = StockDataLoader()
        ensemble_status  = "ON" if self.meta_learner is not None else "OFF (LSTM only)"
        print(f"✓ Ready | seq_len={self.sequence_length} | ensemble={ensemble_status}")


    # ── Ensemble loading ────────────────────────────────────────────────────────

    def _load_ensemble(self):
        xgb_path  = 'saved_models/xgb_model.pkl'
        cnn_path  = 'saved_models/cnn1d_model.pth'
        meta_path = 'saved_models/meta_learner.pkl'

        if not all(os.path.exists(p) for p in [xgb_path, cnn_path, meta_path]):
            print("Ensemble models not found — running in LSTM-only mode.")
            print("Run training/train_ensemble.py after trainlarge.py to enable ensemble.")
            return

        try:
            self.xgb_model    = joblib.load(xgb_path)
            self.meta_learner = joblib.load(meta_path)

            cnn_ckpt = torch.load(cnn_path, map_location=self.device)
            cfg      = cnn_ckpt.get('config', {})
            from models.cnn1d_model import CNN1DModel
            self.cnn_model = CNN1DModel(
                input_size=cfg.get('input_size', len(self.feature_cols)),
                seq_len=cfg.get('seq_len', self.sequence_length)
            )
            self.cnn_model.load_state_dict(cnn_ckpt['model_state_dict'])
            self.cnn_model.to(self.device).eval()
            print("✓ Ensemble loaded: XGBoost + CNN1D + meta-learner")

        except Exception as e:
            print(f"Ensemble load failed: {e} — falling back to LSTM-only.")
            self.xgb_model = self.cnn_model = self.meta_learner = None


    # ── Live price fetch ────────────────────────────────────────────────────────

    def _fetch_live_price(self, symbol):
        """
        Fetch today's actual NSE price via yfinance.
        Returns float price, or None if unavailable / NaN.
        """
        try:
            import yfinance as yf
            ticker = yf.Ticker(f"{symbol}.NS")
            hist   = ticker.history(period="2d")

            if hist is None or hist.empty:
                print(f"Live price unavailable for {symbol} (empty response) — using DB price.")
                return None

            raw_price = hist['Close'].iloc[-1]

            # ── FIX 1: explicit NaN check — float(NaN) is not None ────────────
            if pd.isna(raw_price) or np.isnan(float(raw_price)):
                print(f"Live price is NaN for {symbol} (illiquid/no recent trade) — using DB price.")
                return None

            live_price = float(raw_price)
            if live_price <= 0:
                print(f"Live price invalid ({live_price}) for {symbol} — using DB price.")
                return None

            print(f"✓ Live price fetched for {symbol}: ₹{live_price:.2f}")
            return live_price

        except Exception as e:
            print(f"Live price fetch failed for {symbol}: {e} — using DB price.")
            return None


    # ── Business day helper ─────────────────────────────────────────────────────

    def _get_next_business_days(self, start_date, n):
        if hasattr(start_date, 'date'):
            start_date = start_date.date()

        results = []
        current = start_date
        while len(results) < n:
            current += timedelta(days=1)
            if current.weekday() < 5:
                results.append(current)
        return results


    # ── Core prediction ─────────────────────────────────────────────────────────

    def predict(self, symbol, days_ahead=5):
        if days_ahead < 1 or days_ahead > 365:
            return None

        try:
            df = self.data_loader.load_stock_data(symbol)
            if df is None or len(df) < self.sequence_length + 10:
                return None

            df['target_return'] = df['close_price'].pct_change().shift(-1)
            df = df.dropna()

            if len(df) < self.sequence_length + 10:
                return None

            context_window  = max(self.sequence_length * 3, 120)
            recent_df       = df.tail(context_window).copy()
            scaler          = StandardScaler()
            scaled_features = scaler.fit_transform(recent_df[self.feature_cols].values)

            # ── FIX 2: drop any NaN that survived feature engineering ─────────
            if np.any(np.isnan(scaled_features)):
                scaled_features = np.nan_to_num(scaled_features, nan=0.0)

            db_price  = float(df['close_price'].iloc[-1])
            last_date = df['trade_date'].iloc[-1]

            live_price    = self._fetch_live_price(symbol)
            current_price = live_price if live_price is not None else db_price
            price_source  = "live" if live_price is not None else (
                f"db ({last_date.strftime('%Y-%m-%d') if hasattr(last_date, 'strftime') else last_date})"
            )

            today      = datetime.now().date()
            pred_dates = self._get_next_business_days(today, days_ahead)

            predictions = []
            last_price  = current_price
            sequence    = scaled_features[-self.sequence_length:].copy()

            with torch.no_grad():
                for i in range(days_ahead):
                    X_tensor = torch.FloatTensor(sequence).unsqueeze(0).to(self.device)

                    lstm_raw = float(self.model(X_tensor).cpu().numpy()[0, 0])

                    if self.meta_learner is not None:
                        try:
                            xgb_input = sequence[-1:, :]

                            # ── FIX 3: sanitize each ensemble input ───────────
                            if np.any(np.isnan(xgb_input)):
                                xgb_input = np.nan_to_num(xgb_input, nan=0.0)

                            xgb_prob  = float(self.xgb_model.predict_proba(xgb_input)[0, 1])
                            cnn_logit = float(self.cnn_model(X_tensor).cpu().numpy()[0, 0])

                            # Sanitize individual values before stacking
                            lstm_raw  = 0.0 if np.isnan(lstm_raw)  else lstm_raw
                            xgb_prob  = 0.5 if np.isnan(xgb_prob)  else xgb_prob
                            cnn_logit = 0.0 if np.isnan(cnn_logit) else cnn_logit

                            meta_input = np.array([[lstm_raw, xgb_prob, cnn_logit]])

                            # ── FIX 4: final NaN guard before meta_learner ────
                            if np.any(np.isnan(meta_input)):
                                print(f"NaN in meta_input for {symbol} step {i} — using LSTM direction.")
                                direction = 1 if lstm_raw > 0 else -1
                            else:
                                direction = 1 if self.meta_learner.predict(meta_input)[0] == 1 else -1

                        except Exception as e:
                            print(f"Ensemble step failed for {symbol}: {e} — using LSTM direction.")
                            direction = 1 if lstm_raw > 0 else -1
                    else:
                        direction = 1 if lstm_raw > 0 else -1

                    pred_return     = direction * abs(lstm_raw)
                    predicted_price = last_price * (1 + pred_return)

                    predictions.append({
                        'date':             pred_dates[i].strftime('%Y-%m-%d'),
                        'predicted_price':  round(float(predicted_price), 2),
                        'predicted_return': round(float(pred_return * 100), 2)
                    })

                    last_price   = predicted_price
                    new_row      = sequence[-1].copy()
                    price_change = (predicted_price - current_price) / (current_price + 1e-8)
                    new_row[0]   = price_change
                    sequence     = np.vstack([sequence[1:], new_row.reshape(1, -1)])

            return {
                'symbol':        symbol,
                'current_price': round(current_price, 2),
                'current_date':  today.strftime('%Y-%m-%d'),
                'data_as_of':    last_date.strftime('%Y-%m-%d') if hasattr(last_date, 'strftime') else str(last_date),
                'price_source':  price_source,
                'predictions':   predictions
            }

        except Exception as e:
            print(f"Prediction error for {symbol}: {e}")
            import traceback
            traceback.print_exc()
            return None


# ── Singleton ───────────────────────────────────────────────────────────────────

_predictor = None

def get_predictor():
    global _predictor
    if _predictor is None:
        _predictor = PredictionService()
    return _predictor