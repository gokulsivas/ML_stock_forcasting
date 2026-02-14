import torch
import sys
sys.path.append('..')

from data.data_loader import StockDataLoader
from models.hybrid_lstm_gru import HybridLSTMGRU, count_parameters
from training.dataset import StockSequenceDataset
from training.train import StockTrainer
from torch.utils.data import DataLoader
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import joblib


def create_return_sequences(df, sequence_length=60):
    """Create sequences using percentage returns and normalized features"""
    
    # Calculate returns (this is scale-invariant)
    df['target_return'] = df['close_price'].pct_change().shift(-1)  # Next day return
    
    # Select features (already computed by feature engineering)
    feature_cols = [col for col in df.columns if col not in 
                   ['symbol', 'trade_date', 'close_price', 'open_price', 
                    'high_price', 'low_price', 'volume', 'target_return']]
    
    # Drop NaN
    df = df.dropna()
    
    # Normalize features using StandardScaler (better for returns)
    scaler = StandardScaler()
    X = scaler.fit_transform(df[feature_cols].values)
    y = df['target_return'].values.reshape(-1, 1)
    
    # Create sequences
    X_seq, y_seq = [], []
    for i in range(len(X) - sequence_length):
        X_seq.append(X[i:i + sequence_length])
        y_seq.append(y[i + sequence_length])
    
    return np.array(X_seq), np.array(y_seq), scaler, feature_cols


def train_returns_model(num_stocks=10):
    """Train model to predict returns (scale-invariant)"""
    
    config = {
        'batch_size': 32,
        'sequence_length': 60,
        'hidden_size': 128,
        'num_layers': 2,
        'dropout': 0.2,
        'learning_rate': 0.001,
        'epochs': 100,
        'early_stopping_patience': 15,
        'train_split': 0.7,
        'val_split': 0.15
    }
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Load data
    loader = StockDataLoader()
    symbols = loader.get_stocks_with_min_history(min_days=1500)
    selected_symbols = symbols[:num_stocks]
    
    print(f"Training on {len(selected_symbols)} stocks:")
    for sym in selected_symbols:
        print(f"  - {sym}")
    
    all_X_train, all_y_train = [], []
    all_X_val, all_y_val = [], []
    
    # Collect data from all stocks
    for symbol in selected_symbols:
        print(f"\nProcessing {symbol}...")
        df = loader.load_stock_data(symbol)
        
        if df is None or len(df) < 1500:
            print(f"  Skipping {symbol} - insufficient data")
            continue
        
        # Create sequences with returns
        X_seq, y_seq, scaler, feature_cols = create_return_sequences(df, config['sequence_length'])
        
        if len(X_seq) < 100:
            print(f"  Skipping {symbol} - too few sequences")
            continue
        
        # Split
        train_size = int(len(X_seq) * config['train_split'])
        val_size = int(len(X_seq) * config['val_split'])
        
        all_X_train.append(X_seq[:train_size])
        all_y_train.append(y_seq[:train_size])
        all_X_val.append(X_seq[train_size:train_size+val_size])
        all_y_val.append(y_seq[train_size:train_size+val_size])
        
        print(f"  ✓ Added {len(X_seq[:train_size])} train, {len(X_seq[train_size:train_size+val_size])} val sequences")
    
    # Combine all stocks
    X_train = np.concatenate(all_X_train)
    y_train = np.concatenate(all_y_train)
    X_val = np.concatenate(all_X_val)
    y_val = np.concatenate(all_y_val)
    
    print(f"\n{'='*60}")
    print(f"Total training samples: {len(X_train):,}")
    print(f"Total validation samples: {len(X_val):,}")
    print(f"Input features: {X_train.shape[2]}")
    print(f"{'='*60}")
    
    # Save feature info for later use
    joblib.dump(feature_cols, 'saved_models/returns_feature_cols.pkl')
    
    # Create datasets
    train_dataset = StockSequenceDataset(X_train, y_train)
    val_dataset = StockSequenceDataset(X_val, y_val)
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=config['batch_size'],
        shuffle=True,
        num_workers=4,
        pin_memory=True
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=config['batch_size'],
        num_workers=4,
        pin_memory=True
    )
    
    # Initialize model
    input_size = X_train.shape[2]
    model = HybridLSTMGRU(
        input_size=input_size,
        hidden_size=config['hidden_size'],
        num_layers=config['num_layers'],
        dropout=config['dropout']
    )
    
    print(f"Model parameters: {count_parameters(model):,}")
    
    # Train
    trainer = StockTrainer(model, device, config)
    trainer.train(
        train_loader, 
        val_loader, 
        config['epochs'],
        save_path='saved_models/returns_model.pth'
    )
    
    print("\n" + "="*60)
    print("✓ Returns-based training completed!")
    print("Model saved: saved_models/returns_model.pth")
    print("="*60)


if __name__ == "__main__":
    train_returns_model(num_stocks=10)

