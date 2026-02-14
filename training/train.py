import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.cuda.amp import autocast, GradScaler
import numpy as np
from tqdm import tqdm
import sys
sys.path.append('..')

from data.data_loader import StockDataLoader
from data.preprocessing import TimeSeriesPreprocessor
from models.hybrid_lstm_gru import HybridLSTMGRU, count_parameters
from training.dataset import StockSequenceDataset


class StockTrainer:
    """Training pipeline optimized for RTX 3060 6GB"""
    
    def __init__(self, model, device, config):
        self.model = model.to(device)
        self.device = device
        self.config = config
        
        # Mixed precision training (ESSENTIAL for 6GB VRAM)
        self.scaler = GradScaler()
        
        self.criterion = nn.MSELoss()
        self.optimizer = torch.optim.Adam(
            model.parameters(), 
            lr=config['learning_rate']
        )
        
        # Learning rate scheduler
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode='min', patience=5, factor=0.5
        )
        
        self.best_val_loss = float('inf')
        self.patience_counter = 0
    
    def train_epoch(self, train_loader):
        """Train one epoch with mixed precision"""
        self.model.train()
        total_loss = 0
        
        for X_batch, y_batch in tqdm(train_loader, desc="Training"):
            X_batch = X_batch.to(self.device)
            y_batch = y_batch.to(self.device)
            
            self.optimizer.zero_grad()
            
            # Mixed precision forward pass
            with autocast():
                outputs = self.model(X_batch)
                loss = self.criterion(outputs, y_batch)
            
            # Scaled backward pass
            self.scaler.scale(loss).backward()
            self.scaler.step(self.optimizer)
            self.scaler.update()
            
            total_loss += loss.item()
            
        return total_loss / len(train_loader)
    
    def validate(self, val_loader):
        """Validation with mixed precision"""
        self.model.eval()
        total_loss = 0
        
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch = X_batch.to(self.device)
                y_batch = y_batch.to(self.device)
                
                with autocast():
                    outputs = self.model(X_batch)
                    loss = self.criterion(outputs, y_batch)
                
                total_loss += loss.item()
        
        return total_loss / len(val_loader)
    
    def train(self, train_loader, val_loader, epochs, save_path='saved_models/best_model.pth'):
        """Full training loop with early stopping"""
        
        for epoch in range(epochs):
            train_loss = self.train_epoch(train_loader)
            val_loss = self.validate(val_loader)
            
            # Update learning rate
            self.scheduler.step(val_loss)
            
            print(f"Epoch {epoch+1}/{epochs}")
            print(f"Train Loss: {train_loss:.6f}, Val Loss: {val_loss:.6f}")
            print(f"GPU Memory: {torch.cuda.memory_allocated()/1e9:.2f}GB")
            
            # Save best model
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                self.patience_counter = 0
                torch.save(self.model.state_dict(), save_path)
                print(f"Model saved! Best val loss: {val_loss:.6f}")
            else:
                self.patience_counter += 1
            
            # Early stopping
            if self.patience_counter >= self.config['early_stopping_patience']:
                print(f"Early stopping triggered after {epoch+1} epochs")
                break
            
            # Clear cache
            torch.cuda.empty_cache()


def main():
    """Main training script"""
    
    # Configuration (optimized for 6GB VRAM)
    config = {
        'batch_size': 32,  # Adjust if OOM errors
        'sequence_length': 60,
        'hidden_size': 128,
        'num_layers': 2,
        'dropout': 0.2,
        'learning_rate': 0.001,
        'epochs': 100,
        'early_stopping_patience': 10,
        'train_split': 0.7,
        'val_split': 0.15
    }
    
    # Check GPU
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Load data (start with one stock for testing)
    loader = StockDataLoader()
    symbols = loader.get_stocks_with_min_history(min_days=1500)
    print(f"Found {len(symbols)} stocks with sufficient history")
    
    # Test with first stock
    test_symbol = symbols[0]
    print(f"Training on: {test_symbol}")
    
    df = loader.load_stock_data(test_symbol)
    print(f"Loaded {len(df)} days of data")
    
    # Preprocess
    preprocessor = TimeSeriesPreprocessor(sequence_length=config['sequence_length'])
    preprocessor.fit_scalers(df)
    X, y = preprocessor.transform(df)
    X_seq, y_seq = preprocessor.create_sequences(X, y)
    
    print(f"Sequences shape: {X_seq.shape}, {y_seq.shape}")
    
    # Train/Val/Test split
    train_size = int(len(X_seq) * config['train_split'])
    val_size = int(len(X_seq) * config['val_split'])
    
    X_train = X_seq[:train_size]
    y_train = y_seq[:train_size]
    X_val = X_seq[train_size:train_size+val_size]
    y_val = y_seq[train_size:train_size+val_size]
    
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
    input_size = X_seq.shape[2]
    model = HybridLSTMGRU(
        input_size=input_size,
        hidden_size=config['hidden_size'],
        num_layers=config['num_layers'],
        dropout=config['dropout']
    )
    
    print(f"Model parameters: {count_parameters(model):,}")
    
    # Train
    trainer = StockTrainer(model, device, config)
    trainer.train(train_loader, val_loader, config['epochs'])
    
    # Save preprocessor
    preprocessor.save_scalers()
    print("Training completed!")


if __name__ == "__main__":
    main()
