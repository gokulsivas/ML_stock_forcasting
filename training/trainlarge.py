# training/trainlarge.py

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import joblib
from torch.utils.data import DataLoader
from sklearn.preprocessing import StandardScaler

from data.data_loader import StockDataLoader
from models.hybrid_lstm_gru import HybridLSTMGRU, count_parameters
from training.dataset import StockSequenceDataset


# ── Config ─────────────────────────────────────────────────────────────────────
SEQUENCE_LENGTH = 20      # ← 20-day horizon (optimal for directional NSE prediction)
HIDDEN_SIZE     = 256     # ← increased from 128 (seq_len reduction offsets VRAM cost)
NUM_LAYERS      = 3       # ← deeper for richer temporal representation
DROPOUT         = 0.4     # ← stronger regularization for more features
BATCH_SIZE      = 64
LEARNING_RATE   = 0.0003  # ← lower for stable convergence with directional loss
EPOCHS          = 150
PATIENCE        = 20
TRAIN_SPLIT     = 0.70
VAL_SPLIT       = 0.15
NUM_STOCKS      = 150
BEST_PATH       = 'saved_models/returns_model.pth'
FEAT_COLS_PATH  = 'saved_models/returns_feature_cols.pkl'

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


class DirectionalLoss(nn.Module):
    """
    Combined MSE + directional penalty using tanh (smooth + fully differentiable).
    dir_weight=0.6 focuses the model on getting direction right over magnitude.
    """
    def __init__(self, mse_weight: float = 0.4, dir_weight: float = 0.6):
        super().__init__()
        self.mse_weight = mse_weight
        self.dir_weight = dir_weight

    def forward(self, predictions, targets):
        mse_loss = F.mse_loss(predictions, targets)
        pred_dir = torch.tanh(predictions * 100)
        true_dir = torch.tanh(targets * 100)
        dir_loss = F.mse_loss(pred_dir, true_dir)
        return self.mse_weight * mse_loss + self.dir_weight * dir_loss


def create_return_sequences(df, feature_cols, sequence_length=SEQUENCE_LENGTH):
    """Build (X_seq, y_seq) from a single stock's dataframe."""
    df = df.copy()
    df['target_return'] = df['close_price'].pct_change().shift(-1)
    df = df.dropna()

    cols = [c for c in feature_cols if c in df.columns]
    if not cols:
        return None, None

    scaler = StandardScaler()
    X = scaler.fit_transform(df[cols].values)
    y = df['target_return'].values

    X_seq, y_seq = [], []
    for i in range(len(X) - sequence_length):
        X_seq.append(X[i:i + sequence_length])
        y_seq.append(y[i + sequence_length])

    return (
        np.array(X_seq, dtype=np.float32),
        np.array(y_seq, dtype=np.float32)
    )


def detect_feature_cols(df):
    """Exclude raw OHLCV and target — use everything else as features."""
    exclude = {
        'symbol', 'trade_date', 'close_price',
        'open_price', 'high_price', 'low_price',
        'volume', 'target_return'
    }
    return [c for c in df.columns if c not in exclude]


def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    loader = StockDataLoader()

    # ── Stock selection: NIFTY50 priority + fill to NUM_STOCKS ────────────────
    all_db   = set(loader.get_stocks_with_min_history(min_days=1500))
    priority = [s for s in NIFTY50 if s in all_db]
    others   = sorted([s for s in all_db if s not in set(NIFTY50)])
    symbols  = (priority + others)[:NUM_STOCKS]
    print(f"DB symbols with 1500+ days : {len(all_db)}")
    print(f"NIFTY50 in DB              : {len(priority)}/50")
    print(f"Extra fill                 : {len(symbols) - len(priority)}")
    print(f"Total stocks               : {len(symbols)}")
    print("=" * 60)

    # ── Detect feature cols from first valid stock ─────────────────────────────
    feature_cols = None
    for sym in symbols:
        df = loader.load_stock_data(sym)
        if df is not None and len(df) >= 1500:
            df['target_return'] = df['close_price'].pct_change().shift(-1)
            df = df.dropna()
            feature_cols = detect_feature_cols(df)
            if feature_cols:
                print(f"Feature cols from {sym}: {len(feature_cols)} features")
                print(f"  {feature_cols}")
                break

    if not feature_cols:
        print("ERROR: Could not detect feature columns!")
        return

    os.makedirs('saved_models', exist_ok=True)
    joblib.dump(feature_cols, FEAT_COLS_PATH)
    print(f"Feature cols saved ({len(feature_cols)} features)")
    print("=" * 60)

    # ── Build sequences ────────────────────────────────────────────────────────
    all_X_train, all_y_train = [], []
    all_X_val,   all_y_val   = [], []
    successful, failed       = [], []

    for i, sym in enumerate(symbols):
        print(f"  {i+1}/{len(symbols)} {sym}...", end=' ')
        try:
            df = loader.load_stock_data(sym)
            if df is None or len(df) < 1500:
                print("SKIP - no data")
                failed.append(sym)
                continue

            X_seq, y_seq = create_return_sequences(df, feature_cols)
            if X_seq is None or len(X_seq) < 100:
                print("SKIP - too few sequences")
                failed.append(sym)
                continue

            train_size = int(len(X_seq) * TRAIN_SPLIT)
            val_size   = int(len(X_seq) * VAL_SPLIT)

            all_X_train.append(X_seq[:train_size])
            all_y_train.append(y_seq[:train_size])
            all_X_val.append(X_seq[train_size:train_size + val_size])
            all_y_val.append(y_seq[train_size:train_size + val_size])
            successful.append(sym)
            print(f"OK  {train_size} train seqs")

        except Exception as e:
            print(f"ERROR: {e}")
            failed.append(sym)

    print("=" * 60)
    print(f"Processed: {len(successful)} OK  |  {len(failed)} failed/skipped")

    if not all_X_train:
        print("ERROR: No valid data to train on!")
        return

    X_train = np.concatenate(all_X_train)
    y_train = np.concatenate(all_y_train)
    X_val   = np.concatenate(all_X_val)
    y_val   = np.concatenate(all_y_val)

    print(f"Train: {len(X_train):,}  |  Val: {len(X_val):,}  |  Features: {X_train.shape[2]}")
    print("=" * 60)

    # ── Dataloaders ────────────────────────────────────────────────────────────
    train_loader = DataLoader(
        StockSequenceDataset(X_train, y_train),
        batch_size=BATCH_SIZE, shuffle=True,
        num_workers=0, pin_memory=True
    )
    val_loader = DataLoader(
        StockSequenceDataset(X_val, y_val),
        batch_size=BATCH_SIZE,
        num_workers=0, pin_memory=True
    )

    # ── Model ──────────────────────────────────────────────────────────────────
    input_size = X_train.shape[2]
    model = HybridLSTMGRU(
        input_size=input_size,
        hidden_size=HIDDEN_SIZE,
        num_layers=NUM_LAYERS,
        dropout=DROPOUT
    ).to(device)
    print(f"Model parameters: {count_parameters(model):,}")

    # ── Loss, optimizer, scheduler ─────────────────────────────────────────────
    criterion = DirectionalLoss(mse_weight=0.4, dir_weight=0.6)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', patience=5, factor=0.5
    )

    best_val_loss    = float('inf')
    patience_counter = 0

    # ── Training loop ──────────────────────────────────────────────────────────
    for epoch in range(1, EPOCHS + 1):
        model.train()
        train_loss = 0.0
        for X_batch, y_batch in train_loader:
            X_batch = X_batch.to(device)
            y_batch = y_batch.to(device)
            optimizer.zero_grad()
            preds = model(X_batch).squeeze(1)
            loss  = criterion(preds, y_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item()

        model.eval()
        val_loss    = 0.0
        val_correct = 0
        val_total   = 0
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch = X_batch.to(device)
                y_batch = y_batch.to(device)
                preds    = model(X_batch).squeeze(1)
                loss     = criterion(preds, y_batch)
                val_loss += loss.item()
                val_correct += ((preds > 0) == (y_batch > 0)).sum().item()
                val_total   += y_batch.size(0)

        avg_train = train_loss / len(train_loader)
        avg_val   = val_loss   / len(val_loader)
        dir_acc   = val_correct / val_total * 100
        scheduler.step(avg_val)

        print(f"Epoch {epoch:3d}/{EPOCHS} | "
              f"Train Loss: {avg_train:.6f} | "
              f"Val Loss: {avg_val:.6f} | "
              f"Dir Acc: {dir_acc:.2f}%")

        if avg_val < best_val_loss:
            best_val_loss    = avg_val
            patience_counter = 0
            torch.save({
                'epoch':            epoch,
                'model_state_dict': model.state_dict(),
                'val_loss':         avg_val,
                'dir_acc':          dir_acc,
                'config': {
                    'input_size':      input_size,
                    'hidden_size':     HIDDEN_SIZE,
                    'num_layers':      NUM_LAYERS,
                    'dropout':         DROPOUT,
                    'sequence_length': SEQUENCE_LENGTH,   # ← saved for prediction_service
                }
            }, BEST_PATH)
            print(f"  --> Best model saved! Dir Acc: {dir_acc:.2f}%")
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"Early stopping at epoch {epoch}")
                break

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    joblib.dump(successful, 'saved_models/trained_stocks.pkl')
    print("=" * 60)
    print(f"Training complete! Model: {BEST_PATH}")
    print(f"Trained on {len(successful)} stocks")
    print("=" * 60)


if __name__ == '__main__':
    train()