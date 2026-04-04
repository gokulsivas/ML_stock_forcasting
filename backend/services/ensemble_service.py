# backend/services/ensemble_service.py

import os
import sys
import numpy as np
import joblib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from data.data_loader import StockDataLoader
from data.feature_engineering import FeatureEngineer

MODEL_DIR = 'saved_models'


class EnsemblePredictionService:

    def __init__(self):
        self.xgb    = joblib.load(f'{MODEL_DIR}/ensemble_xgb.pkl')
        self.lgbm   = joblib.load(f'{MODEL_DIR}/ensemble_lgbm.pkl')
        self.scaler = joblib.load(f'{MODEL_DIR}/ensemble_scaler.pkl')
        self.feature_cols = joblib.load(f'{MODEL_DIR}/ensemble_feature_cols.pkl')
        weights     = joblib.load(f'{MODEL_DIR}/ensemble_weights.pkl')
        self.w_xgb  = weights['xgb_weight']
        self.w_lgbm = weights['lgbm_weight']

        self.loader   = StockDataLoader()
        self.engineer = FeatureEngineer()
        print("✓ Ensemble (XGBoost + LightGBM) loaded successfully")

    def predict(self, symbol):
        try:
            df = self.loader.load_stock_data(symbol)
            if df is None or len(df) < 100:
                return None

            df = self.engineer.add_technical_indicators(df)
            df = df.dropna()

            cols = [c for c in self.feature_cols if c in df.columns]
            X    = df[cols].values[-1:]          # latest row only
            X_sc = self.scaler.transform(X)

            xgb_prob  = self.xgb.predict_proba(X_sc)[0, 1]
            lgbm_prob = self.lgbm.predict_proba(X_sc)[0, 1]
            avg_prob  = self.w_xgb * xgb_prob + self.w_lgbm * lgbm_prob

            if avg_prob >= 0.55:
                signal = "UP"
            elif avg_prob <= 0.45:
                signal = "DOWN"
            else:
                signal = "SIDEWAYS"

            return {
                'symbol':      symbol,
                'signal':      signal,
                'confidence':  round(float(avg_prob) * 100, 2),
                'xgb_prob':    round(float(xgb_prob) * 100, 2),
                'lgbm_prob':   round(float(lgbm_prob) * 100, 2),
            }

        except Exception as e:
            print(f"Ensemble prediction error for {symbol}: {e}")
            import traceback
            traceback.print_exc()
            return None


_ensemble = None

def get_ensemble_predictor():
    global _ensemble
    if _ensemble is None:
        _ensemble = EnsemblePredictionService()
    return _ensemble