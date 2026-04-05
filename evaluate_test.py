import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)

from data.data_loader import StockDataLoader
from models.hybrid_lstm_gru import HybridLSTMGRU
from models.cnn1d_model import CNN1DModel

SEQUENCE_LENGTH = 20
LSTM_PATH  = 'saved_models/returns_model.pth'
XGB_PATH   = 'saved_models/xgb_model.pkl'
CNN_PATH   = 'saved_models/cnn1d_model.pth'
META_PATH  = 'saved_models/meta_learner.pkl'
FEAT_PATH  = 'saved_models/returns_feature_cols.pkl'

TEST_SYMBOLS = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
    'SBIN',  'WIPRO', 'TITAN', 'MARUTI', 'BAJFINANCE',
    'AXISBANK', 'LT', 'SUNPHARMA', 'HCLTECH', 'KOTAKBANK'
]

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

print("Loading models...")
feature_cols = joblib.load(FEAT_PATH)

ckpt       = torch.load(LSTM_PATH, map_location=device)
cfg        = ckpt.get('config', {})
lstm_model = HybridLSTMGRU(
    input_size  = cfg.get('input_size',  len(feature_cols)),
    hidden_size = cfg.get('hidden_size', 256),
    num_layers  = cfg.get('num_layers',  3),
    dropout     = cfg.get('dropout',     0.4)
)
lstm_model.load_state_dict(ckpt['model_state_dict'])
lstm_model.to(device).eval()

xgb_model  = joblib.load(XGB_PATH)
meta_model = joblib.load(META_PATH)

cnn_ckpt   = torch.load(CNN_PATH, map_location=device)
cnn_cfg    = cnn_ckpt.get('config', {})
cnn_model  = CNN1DModel(
    input_size = cnn_cfg.get('input_size', len(feature_cols)),
    seq_len    = cnn_cfg.get('seq_len',    SEQUENCE_LENGTH)
)
cnn_model.load_state_dict(cnn_ckpt['model_state_dict'])
cnn_model.to(device).eval()
print(f"All models loaded. Features: {len(feature_cols)}\n")

loader = StockDataLoader()

all_y_true, all_y_pred = [], []
per_stock_results = []

for symbol in TEST_SYMBOLS:
    try:
        df = loader.load_stock_data(symbol)
        if df is None or len(df) < 300:
            print(f"  SKIP {symbol} — not enough data")
            continue

        df['target_return'] = df['close_price'].pct_change().shift(-1)
        df = df.dropna()

        cols = [c for c in feature_cols if c in df.columns]
        scaler = StandardScaler()
        X = scaler.fit_transform(df[cols].values)
        y = df['target_return'].values
        y_cls = (y > 0).astype(int)

        X_seq, y_seq = [], []
        for i in range(len(X) - SEQUENCE_LENGTH):
            X_seq.append(X[i:i + SEQUENCE_LENGTH])
            y_seq.append(y_cls[i + SEQUENCE_LENGTH])
        X_seq = np.array(X_seq, dtype=np.float32)
        y_seq = np.array(y_seq)

        test_start = int(len(X_seq) * 0.85)
        X_test = X_seq[test_start:]
        y_test = y_seq[test_start:]

        if len(X_test) < 20:
            print(f"  SKIP {symbol} — test set too small")
            continue

        with torch.no_grad():
            X_t      = torch.FloatTensor(X_test).to(device)
            lstm_out = lstm_model(X_t).squeeze(1).cpu().numpy()

        X_last       = X_test[:, -1, :]
        xgb_probs    = xgb_model.predict_proba(X_last)[:, 1]

        with torch.no_grad():
            cnn_out = cnn_model(torch.FloatTensor(X_test).to(device)).squeeze(1).cpu().numpy()

        meta_input = np.column_stack([lstm_out, xgb_probs, cnn_out])
        y_pred     = meta_model.predict(meta_input)

        acc     = accuracy_score(y_test, y_pred) * 100
        prec    = precision_score(y_test, y_pred, zero_division=0) * 100
        rec     = recall_score(y_test, y_pred, zero_division=0) * 100
        f1      = f1_score(y_test, y_pred, zero_division=0) * 100
        cm      = confusion_matrix(y_test, y_pred)

        tn, fp, fn, tp = cm.ravel()
        up_acc   = (tp / (tp + fn) * 100) if (tp + fn) > 0 else 0
        down_acc = (tn / (tn + fp) * 100) if (tn + fp) > 0 else 0

        all_y_true.extend(y_test)
        all_y_pred.extend(y_pred)
        per_stock_results.append({
            'symbol': symbol, 'samples': len(y_test),
            'acc': acc, 'up_acc': up_acc, 'down_acc': down_acc,
            'precision': prec, 'recall': rec, 'f1': f1
        })
        print(f"  {symbol:<12} | Acc: {acc:.1f}% | UP: {up_acc:.1f}% | DOWN: {down_acc:.1f}% | F1: {f1:.1f}% | n={len(y_test)}")

    except Exception as e:
        print(f"  ERROR {symbol}: {e}")

print("\n" + "=" * 65)
print("  STOCKCAST — ENSEMBLE EVALUATION RESULTS")
print("=" * 65)

all_y_true = np.array(all_y_true)
all_y_pred = np.array(all_y_pred)

overall_acc  = accuracy_score(all_y_true, all_y_pred) * 100
overall_prec = precision_score(all_y_true, all_y_pred, zero_division=0) * 100
overall_rec  = recall_score(all_y_true, all_y_pred, zero_division=0) * 100
overall_f1   = f1_score(all_y_true, all_y_pred, zero_division=0) * 100

cm           = confusion_matrix(all_y_true, all_y_pred)
tn, fp, fn, tp = cm.ravel()
overall_up   = tp / (tp + fn) * 100
overall_down = tn / (tn + fp) * 100
balance_gap  = abs(overall_up - overall_down)

print(f"\n  Stocks evaluated       : {len(per_stock_results)}")
print(f"  Total test samples     : {len(all_y_true):,}")
print(f"\n  Directional Accuracy   : {overall_acc:.2f}%")
print(f"  UP   Accuracy          : {overall_up:.2f}%")
print(f"  DOWN Accuracy          : {overall_down:.2f}%")
print(f"  Directional Balance    : {balance_gap:.2f}% gap  ", end="")
print("Balanced" if balance_gap < 10 else "Biased")
print(f"\n  Precision              : {overall_prec:.2f}%")
print(f"  Recall                 : {overall_rec:.2f}%")
print(f"  F1 Score               : {overall_f1:.2f}%")

print(f"\n  Per-stock avg accuracy : {np.mean([r['acc'] for r in per_stock_results]):.2f}%")
best  = max(per_stock_results, key=lambda x: x['acc'])
worst = min(per_stock_results, key=lambda x: x['acc'])
print(f"  Best  stock            : {best['symbol']} ({best['acc']:.1f}%)")
print(f"  Worst stock            : {worst['symbol']} ({worst['acc']:.1f}%)")

print("\n" + "=" * 65)
print("  RESUME NUMBERS (copy these)")
print("=" * 65)
print(f"  - Directional accuracy : {overall_acc:.1f}% across {len(per_stock_results)} NSE stocks")
print(f"  - F1 Score             : {overall_f1:.1f}%")
print(f"  - UP/DOWN balance      : {overall_up:.1f}% / {overall_down:.1f}%")
print(f"  - Test samples         : {len(all_y_true):,} out-of-sample predictions")
print(f"  - Trained on           : {len(joblib.load('saved_models/trained_stocks.pkl'))} NIFTY stocks")
print("=" * 65)