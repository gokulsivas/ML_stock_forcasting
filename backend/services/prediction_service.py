import torch
import numpy as np
import sys
sys.path.append('..')

from models.hybrid_lstm_gru import HybridLSTMGRU
from data.data_loader import StockDataLoader
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import joblib
import pandas as pd


class PredictionService:
    """Handle model inference for API"""

    def __init__(self, model_path='saved_models/returns_model.pth'):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Loading model on device: {self.device}")

        # Load feature columns
        self.feature_cols = joblib.load('saved_models/returns_feature_cols.pkl')

        # Load model
        input_size = len(self.feature_cols)
        self.model = HybridLSTMGRU(
            input_size=input_size,
            hidden_size=128,
            num_layers=2
        )
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()

        self.data_loader = StockDataLoader()
        print("✓ Model loaded successfully")

    def predict(self, symbol, days_ahead=5):
        """Generate predictions for N days ahead"""
        
        # Limit to reasonable range
        if days_ahead < 1 or days_ahead > 365:
            return None

        try:
            # Load stock data
            df = self.data_loader.load_stock_data(symbol)
            if df is None or len(df) < 60:
                return None

            # Calculate returns
            df['target_return'] = df['close_price'].pct_change().shift(-1)
            df = df.dropna()

            if len(df) < 60:
                return None

            # Get last 60 days
            recent_df = df.tail(60).copy()

            # Normalize features
            scaler = StandardScaler()
            scaled_features = scaler.fit_transform(recent_df[self.feature_cols].values)

            # Current price and date
            current_price = float(df['close_price'].iloc[-1])
            last_date = df['trade_date'].iloc[-1]

            predictions = []
            last_price = current_price
            
            # Create initial sequence
            sequence = scaled_features[-60:].copy()

            # Predict iteratively
            with torch.no_grad():
                for i in range(days_ahead):
                    # Prepare input tensor
                    X_tensor = torch.FloatTensor(sequence).unsqueeze(0).to(self.device)
                    
                    # Predict return
                    pred_return = self.model(X_tensor).cpu().numpy()[0, 0]

                    # Convert return to price
                    predicted_price = last_price * (1 + pred_return)

                    # Calculate next date (skip weekends)
                    pred_date = last_date + timedelta(days=i + 1)
                    while pred_date.weekday() >= 5:  # Skip Saturday and Sunday
                        pred_date += timedelta(days=1)

                    predictions.append({
                        'date': pred_date.strftime('%Y-%m-%d'),
                        'predicted_price': round(float(predicted_price), 2),
                        'predicted_return': round(float(pred_return * 100), 2)
                    })

                    # Update for next iteration
                    last_price = predicted_price
                    
                    # Create new feature row (approximation using last known values)
                    new_row = sequence[-1].copy()
                    # Update the close price feature (assuming it's the first feature)
                    price_change = (predicted_price - current_price) / current_price
                    new_row[0] = price_change  # Normalized price change
                    
                    # Shift sequence and add new prediction
                    sequence = np.vstack([sequence[1:], new_row.reshape(1, -1)])

            return {
                'symbol': symbol,
                'current_price': round(current_price, 2),
                'current_date': last_date.strftime('%Y-%m-%d'),
                'predictions': predictions
            }

        except Exception as e:
            print(f"Prediction error for {symbol}: {e}")
            import traceback
            traceback.print_exc()
            return None


# Global instance
_predictor = None

def get_predictor():
    global _predictor
    if _predictor is None:
        _predictor = PredictionService()
    return _predictor
