# training/train.py

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
import numpy as np
from tqdm import tqdm
import sys
sys.path.append('..')

from data.data_loader import StockDataLoader
from data.preprocessing import TimeSeriesPreprocessor
from models.hybrid_lstm_gru import HybridLSTMGRU, count_parameters
from training.dataset import StockSequenceDataset


class DirectionalLoss(nn.Module):
    """
    Combined MSE + directional penalty.
    Uses tanh to create smooth, fully differentiable direction signals.
    Multiplying returns by 100 before tanh: tanh(1.0)~0.76 vs tanh(0.01)~0.01,
    which creates a strong directional gradient even for small return values.
    """
    def __init__(self, mse_weight: float = 0.4, dir_weight: float = 0.6):
        super().__init__()
        self.mse_weight = mse_weight
        self.dir_weight = dir_weight

    def forward(self, predictions, targets):
        mse_loss = F.mse_loss(predictions, targets)
        # Amplify returns before tanh so direction signal is strong
        pred_dir = torch.tanh(predictions * 100)
        true_dir = torch.tanh(targets * 100)
        dir_loss = F.mse_loss(pred_dir, true_dir)
        return self.mse_weight * mse_loss + self.dir_weight * dir_loss


class StockTrainer:
    """Training pipeline optimized for RTX 3060 6GB"""

    def __init__(self, model, device, config):
        self.model  = model.to(device)
        self.device = device
        self.config = config

        self.scaler = torch.amp.GradScaler('cuda')

        # Directional loss — focuses training on getting direction right
        self.criterion = DirectionalLoss(mse_weight=0.4, dir_weight=0.6)

        self.optimizer = torch.optim.Adam(
            model.parameters(),
            lr=config['learning_rate']
        )
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode='min', patience=5, factor=0.5
        )
        self.best_val_loss    = float('inf')
        self.patience_counter = 0

    def train_epoch(self, train_loader):
        self.model.train()
        total_loss = 0

        for X_batch, y_batch in tqdm(train_loader, desc="Training"):
            X_batch = X_batch.to(self.device)
            y_batch = y_batch.to(self.device)

            self.optimizer.zero_grad()

            with torch.amp.autocast('cuda'):
                outputs = self.model(X_batch)
                loss    = self.criterion(outputs, y_batch)

            self.scaler.scale(loss).backward()
            self.scaler.step(self.optimizer)
            self.scaler.update()

            total_loss += loss.item()

        return total_loss / len(train_loader)

    def validate(self, val_loader):
        self.model.eval()
        total_loss  = 0
        correct_dir = 0
        total       = 0

        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch = X_batch.to(self.device)
                y_batch = y_batch.to(self.device)

                with torch.amp.autocast('cuda'):
                    outputs = self.model(X_batch)
                    loss    = self.criterion(outputs, y_batch)

                total_loss  += loss.item()
                correct_dir += ((outputs > 0) == (y_batch > 0)).sum().item()
                total       += y_batch.size(0)

        dir_acc = correct_dir / total * 100
        return total_loss / len(val_loader), dir_acc

    def train(self, train_loader, val_loader, epochs,
              save_path='saved_models/best_model.pth'):

        for epoch in range(epochs):
            train_loss            = self.train_epoch(train_loader)
            val_loss, dir_acc     = self.validate(val_loader)

            self.scheduler.step(val_loss)

            print(f"Epoch {epoch+1}/{epochs}")
            print(f"Train Loss: {train_loss:.6f} | Val Loss: {val_loss:.6f} | Dir Acc: {dir_acc:.2f}%")
            if torch.cuda.is_available():
                print(f"GPU Memory: {torch.cuda.memory_allocated()/1e9:.2f}GB")

            if val_loss < self.best_val_loss:
                self.best_val_loss    = val_loss
                self.patience_counter = 0
                torch.save(self.model.state_dict(), save_path)
                print(f"✓ Saved! Best val loss: {val_loss:.6f} | Dir Acc: {dir_acc:.2f}%")
            else:
                self.patience_counter += 1

            if self.patience_counter >= self.config['early_stopping_patience']:
                print(f"Early stopping after {epoch+1} epochs")
                break

            torch.cuda.empty_cache()


def main():
    config = {
        'batch_size':               64,
        'sequence_length':          20,   # ← 20-day horizon (optimal per NSE research)
        'hidden_size':             256,   # ← increased capacity
        'num_layers':                3,   # ← deeper model
        'dropout':                 0.4,   # ← stronger regularization
        'learning_rate':        0.0003,   # ← lower LR for stable convergence
        'epochs':                  200,
        'early_stopping_patience':  30,
        'train_split':             0.7,
        'val_split':              0.15
    }

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    loader  = StockDataLoader()
    symbols = loader.get_stocks_with_min_history(min_days=1500)
    print(f"Found {len(symbols)} stocks with sufficient history")

    test_symbol = symbols[0]
    print(f"Training on: {test_symbol}")

    df = loader.load_stock_data(test_symbol)
    print(f"Loaded {len(df)} days of data")

    preprocessor = TimeSeriesPreprocessor(sequence_length=config['sequence_length'])
    preprocessor.fit_scalers(df)
    X, y         = preprocessor.transform(df)
    X_seq, y_seq = preprocessor.create_sequences(X, y)
    print(f"Sequences shape: {X_seq.shape}, {y_seq.shape}")

    train_size = int(len(X_seq) * config['train_split'])
    val_size   = int(len(X_seq) * config['val_split'])

    train_loader = DataLoader(
        StockSequenceDataset(X_seq[:train_size], y_seq[:train_size]),
        batch_size=config['batch_size'], shuffle=True,
        num_workers=0, pin_memory=True
    )
    val_loader = DataLoader(
        StockSequenceDataset(
            X_seq[train_size:train_size + val_size],
            y_seq[train_size:train_size + val_size]
        ),
        batch_size=config['batch_size'],
        num_workers=0, pin_memory=True
    )

    input_size = X_seq.shape[2]
    model = HybridLSTMGRU(
        input_size=input_size,
        hidden_size=config['hidden_size'],
        num_layers=config['num_layers'],
        dropout=config['dropout']
    )
    print(f"Model parameters: {count_parameters(model):,}")

    trainer = StockTrainer(model, device, config)
    trainer.train(train_loader, val_loader, config['epochs'])

    preprocessor.save_scalers()
    print("Training completed!")


if __name__ == "__main__":
    main()