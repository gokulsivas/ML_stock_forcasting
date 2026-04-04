# training/train_ensemble.py
#
# Run this AFTER trainlarge.py has finished retraining the LSTM.
# Trains XGBoost + CNN1D direction classifiers, then fits a
# Logistic Regression meta-learner to blend all three.
#
# Output files:
#   saved_models/xgb_model.pkl
#   saved_models/cnn1d_model.pth
#   saved_models/meta_learner.pkl

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import torch.nn as nn
import numpy as np
import joblib
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from xgboost import XGBClassifier

from data.data_loader import StockDataLoader
from models.hybrid_lstm_gru import HybridLSTMGRU
from models.cnn1d_model import CNN1DModel


# ── Config ─────────────────────────────────────────────────────────────────────
SEQUENCE_LENGTH = 20
BATCH_SIZE      = 256
CNN_EPOCHS      = 60
CNN_PATIENCE    = 10
NUM_STOCKS      = 150
TRAIN_SPLIT     = 0.70
VAL_SPLIT       = 0.15

LSTM_PATH  = 'saved_models/returns_model.pth'
FEAT_PATH  = 'saved_models/returns_feature_cols.pkl'
XGB_PATH   = 'saved_models/xgb_model.pkl'
CNN_PATH   = 'saved_models/cnn1d_model.pth'
META_PATH  = 'saved_models/meta_learner.pkl'

NIFTY50 = [
    "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN",
    "BHARTIARTL","KOTAKBANK","ITC","LT","AXISBANK","ASIANPAINT","MARUTI",
    "SUNPHARMA","TITAN","BAJFINANCE","NESTLEIND","WIPRO","HCLTECH","TECHM",
    "ULTRACEMCO","POWERGRID","NTPC","ONGC","COALINDIA","DIVISLAB","DRREDDY",
    "CIPLA","EICHERMOT","BAJAJFINSV","BPCL","HEROMOTOCO","HINDALCO","GRASIM",
    "INDUSINDBK","JSWSTEEL","M&M","TATASTEEL","ADANIPORTS","APOLLOHOSP",
    "BRITANNIA","SBILIFE","HDFCLIFE","TATACONSUM","PIDILITIND","BAJAJ-AUTO",
    "LTIM","ADANIENT","TATAMOTORS",
]


# ── Data helpers ───────────────────────────────────────────────────────────────

def create_sequences(df, feature_cols, seq_len=SEQUENCE_LENGTH):
    """
    Returns:
        X_seq   : (N, seq_len, n_features)  float32
        y_ret   : (N,)  float32  — raw next-day return
        y_cls   : (N,)  int64   — 1=up, 0=down
    """
    df = df.copy()
    df['target_return'] = df['close_price'].pct_change().shift(-1)
    df = df.dropna()

    cols = [c for c in feature_cols if c in df.columns]
    if not cols:
        return None, None, None

    scaler = StandardScaler()
    X = scaler.fit_transform(df[cols].values)
    y = df['target_return'].values
    y_cls = (y > 0).astype(np.int64)

    X_seq, y_ret_seq, y_cls_seq = [], [], []
    for i in range(len(X) - seq_len):
        X_seq.append(X[i:i + seq_len])
        y_ret_seq.append(y[i + seq_len])
        y_cls_seq.append(y_cls[i + seq_len])

    return (
        np.array(X_seq,     dtype=np.float32),
        np.array(y_ret_seq, dtype=np.float32),
        np.array(y_cls_seq, dtype=np.int64)
    )


# ── Model inference helpers ────────────────────────────────────────────────────

def get_lstm_preds(model, X_np, device, batch_size=512):
    """Returns raw LSTM return predictions (float array)."""
    model.eval()
    preds = []
    X_t = torch.FloatTensor(X_np)
    with torch.no_grad():
        for i in range(0, len(X_t), batch_size):
            batch = X_t[i:i + batch_size].to(device)
            out   = model(batch).squeeze(1).cpu().numpy()
            preds.extend(out)
    return np.array(preds, dtype=np.float32)


def get_cnn_preds(model, X_np, device, batch_size=512):
    """Returns raw CNN logits (float array). Positive = predicts UP."""
    model.eval()
    preds = []
    X_t = torch.FloatTensor(X_np)
    with torch.no_grad():
        for i in range(0, len(X_t), batch_size):
            batch = X_t[i:i + batch_size].to(device)
            out   = model(batch).squeeze(1).cpu().numpy()
            preds.extend(out)
    return np.array(preds, dtype=np.float32)


# ── CNN training ───────────────────────────────────────────────────────────────

def train_cnn(X_train, y_train, X_val, y_val, input_size, device):
    """
    Train CNN1D as a binary direction classifier.
    y_train / y_val: float32 arrays of 0.0 or 1.0 (direction labels).
    Returns: trained CNN1DModel
    """
    model     = CNN1DModel(input_size=input_size, seq_len=SEQUENCE_LENGTH).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', patience=5, factor=0.5
    )

    X_tr = torch.FloatTensor(X_train)
    y_tr = torch.FloatTensor(y_train)
    X_vl = torch.FloatTensor(X_val).to(device)
    y_vl = torch.FloatTensor(y_val).to(device)

    train_loader = DataLoader(
        TensorDataset(X_tr, y_tr),
        batch_size=BATCH_SIZE, shuffle=True, num_workers=0
    )

    best_val_loss    = float('inf')
    patience_counter = 0
    best_state       = None

    for epoch in range(1, CNN_EPOCHS + 1):
        model.train()
        train_loss = 0.0
        for Xb, yb in train_loader:
            Xb, yb = Xb.to(device), yb.to(device)
            optimizer.zero_grad()
            out  = model(Xb).squeeze(1)
            loss = criterion(out, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_loss += loss.item()

        model.eval()
        with torch.no_grad():
            val_out  = model(X_vl).squeeze(1)
            val_loss = criterion(val_out, y_vl).item()
            val_acc  = ((val_out > 0) == (y_vl > 0.5)).float().mean().item() * 100

        scheduler.step(val_loss)
        print(f"  CNN Epoch {epoch:3d}/{CNN_EPOCHS} | "
              f"Train: {train_loss/len(train_loader):.4f} | "
              f"Val: {val_loss:.4f} | Dir Acc: {val_acc:.2f}%")

        if val_loss < best_val_loss:
            best_val_loss    = val_loss
            patience_counter = 0
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= CNN_PATIENCE:
                print(f"  CNN early stopping at epoch {epoch}")
                break

    model.load_state_dict(best_state)
    return model


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}")

    # Load feature columns saved by trainlarge.py
    feature_cols = joblib.load(FEAT_PATH)
    print(f"Feature cols: {len(feature_cols)}")

    # ── Load pre-trained LSTM ────────────────────────────────────────────────
    checkpoint = torch.load(LSTM_PATH, map_location=device)
    if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
        cfg         = checkpoint.get('config', {})
        input_size  = cfg.get('input_size',  len(feature_cols))
        hidden_size = cfg.get('hidden_size', 256)
        num_layers  = cfg.get('num_layers',  3)
        dropout     = cfg.get('dropout',     0.4)
        state_dict  = checkpoint['model_state_dict']
    else:
        input_size  = len(feature_cols)
        hidden_size, num_layers, dropout = 256, 3, 0.4
        state_dict  = checkpoint

    lstm_model = HybridLSTMGRU(
        input_size=input_size, hidden_size=hidden_size,
        num_layers=num_layers, dropout=dropout
    )
    lstm_model.load_state_dict(state_dict)
    lstm_model.to(device).eval()
    print(f"LSTM loaded (input={input_size}, hidden={hidden_size}, layers={num_layers})")

    # ── Load stock data and build sequences ──────────────────────────────────
    loader   = StockDataLoader()
    all_db   = set(loader.get_stocks_with_min_history(min_days=1500))
    priority = [s for s in NIFTY50 if s in all_db]
    others   = sorted([s for s in all_db if s not in set(NIFTY50)])
    symbols  = (priority + others)[:NUM_STOCKS]
    print(f"Loading data from {len(symbols)} stocks...")

    all_X_tr, all_y_tr_cls = [], []
    all_X_vl, all_y_vl_cls = [], []

    for i, sym in enumerate(symbols):
        print(f"  {i+1}/{len(symbols)} {sym}...", end=' ')
        try:
            df = loader.load_stock_data(sym)
            if df is None or len(df) < 300:
                print("SKIP")
                continue
            X_seq, y_ret, y_cls = create_sequences(df, feature_cols)
            if X_seq is None or len(X_seq) < 50:
                print("SKIP - too few seqs")
                continue
            tr = int(len(X_seq) * TRAIN_SPLIT)
            vl = int(len(X_seq) * VAL_SPLIT)
            all_X_tr.append(X_seq[:tr]);              all_y_tr_cls.append(y_cls[:tr])
            all_X_vl.append(X_seq[tr:tr + vl]);      all_y_vl_cls.append(y_cls[tr:tr + vl])
            print(f"OK  {tr} train seqs")
        except Exception as e:
            print(f"ERROR: {e}")

    X_train   = np.concatenate(all_X_tr)
    y_tr_cls  = np.concatenate(all_y_tr_cls)
    X_val     = np.concatenate(all_X_vl)
    y_vl_cls  = np.concatenate(all_y_vl_cls)
    print(f"\nTrain: {len(X_train):,}  Val: {len(X_val):,}")
    print("=" * 60)

    # ── LSTM baseline on val ─────────────────────────────────────────────────
    print("Getting LSTM predictions on validation set...")
    lstm_val = get_lstm_preds(lstm_model, X_val, device)
    lstm_acc = ((lstm_val > 0) == (y_vl_cls == 1)).mean() * 100
    print(f"LSTM standalone dir acc: {lstm_acc:.2f}%")

    # ── XGBoost on last-timestep features ────────────────────────────────────
    print("\nTraining XGBoost (last-timestep features)...")
    X_tr_last  = X_train[:, -1, :]   # (n_train, n_features)
    X_vl_last  = X_val[:,   -1, :]

    xgb = XGBClassifier(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        early_stopping_rounds=30,       # in constructor — compatible with all versions
        eval_metric='logloss',
        tree_method='hist',
        verbosity=0,
        n_jobs=-1,
        random_state=42
    )
    xgb.fit(
        X_tr_last, y_tr_cls,
        eval_set=[(X_vl_last, y_vl_cls)],
        verbose=50
    )
    xgb_val_probs = xgb.predict_proba(X_vl_last)[:, 1]
    xgb_acc       = accuracy_score(y_vl_cls, (xgb_val_probs > 0.5).astype(int)) * 100
    print(f"XGBoost standalone dir acc: {xgb_acc:.2f}%")
    joblib.dump(xgb, XGB_PATH)
    print(f"XGBoost saved → {XGB_PATH}")

    # ── CNN1D classifier ─────────────────────────────────────────────────────
    print("\nTraining CNN1D direction classifier...")
    cnn = train_cnn(
        X_train, y_tr_cls.astype(np.float32),
        X_val,   y_vl_cls.astype(np.float32),
        input_size=X_train.shape[2],
        device=device
    )
    cnn_val_logits = get_cnn_preds(cnn, X_val, device)
    cnn_acc        = ((cnn_val_logits > 0) == (y_vl_cls == 1)).mean() * 100
    print(f"CNN1D standalone dir acc: {cnn_acc:.2f}%")
    torch.save({
        'model_state_dict': cnn.state_dict(),
        'config': {
            'input_size': X_train.shape[2],
            'seq_len':    SEQUENCE_LENGTH
        }
    }, CNN_PATH)
    print(f"CNN1D saved → {CNN_PATH}")

    # ── Meta-learner: stack all 3 on VAL ──────────────────────────────────────
    print("\nBuilding meta-features on train set...")
    lstm_tr      = get_lstm_preds(lstm_model, X_train, device)
    xgb_tr_probs = xgb.predict_proba(X_tr_last)[:, 1]
    cnn_tr       = get_cnn_preds(cnn, X_train, device)

    meta_train = np.column_stack([lstm_tr,  xgb_tr_probs,  cnn_tr])
    meta_val   = np.column_stack([lstm_val, xgb_val_probs, cnn_val_logits])

    print("Training Logistic Regression meta-learner...")
    meta = LogisticRegression(C=1.0, max_iter=2000, random_state=42)
    meta.fit(meta_train, y_tr_cls)

    meta_preds = meta.predict(meta_val)
    meta_acc   = accuracy_score(y_vl_cls, meta_preds) * 100
    print(f"Meta-learner ensemble dir acc: {meta_acc:.2f}%")
    joblib.dump(meta, META_PATH)
    print(f"Meta-learner saved → {META_PATH}")

    print("=" * 60)
    print("ENSEMBLE TRAINING COMPLETE")
    print(f"  LSTM alone      : {lstm_acc:.2f}%")
    print(f"  XGBoost alone   : {xgb_acc:.2f}%")
    print(f"  CNN1D alone     : {cnn_acc:.2f}%")
    print(f"  Ensemble (meta) : {meta_acc:.2f}%  ← this is what prediction_service uses")
    print("=" * 60)


if __name__ == '__main__':
    main()