import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib


class TimeSeriesPreprocessor:
    """Prepare data for LSTM/GRU training"""
    
    def __init__(self, sequence_length=60, target_column='close_price'):
        self.sequence_length = sequence_length
        self.target_column = target_column
        self.feature_scaler = MinMaxScaler()
        self.target_scaler = MinMaxScaler()
        self.feature_columns = None
    
    def fit_scalers(self, df):
        """Fit scalers on training data"""
        self.feature_columns = [col for col in df.columns 
                               if col not in ['symbol', 'trade_date', self.target_column]]
        
        X = df[self.feature_columns].values
        y = df[[self.target_column]].values
        
        self.feature_scaler.fit(X)
        self.target_scaler.fit(y)
    
    def transform(self, df):
        """Scale features and target"""
        X = self.feature_scaler.transform(df[self.feature_columns].values)
        y = self.target_scaler.transform(df[[self.target_column]].values)
        
        return X, y
    
    def create_sequences(self, X, y):
        """Create sliding window sequences"""
        X_seq, y_seq = [], []
        
        for i in range(len(X) - self.sequence_length):
            X_seq.append(X[i:i + self.sequence_length])
            y_seq.append(y[i + self.sequence_length])
        
        return np.array(X_seq), np.array(y_seq)
    
    def save_scalers(self, path='saved_models/'):
        """Save fitted scalers"""
        joblib.dump(self.feature_scaler, f'{path}feature_scaler.pkl')
        joblib.dump(self.target_scaler, f'{path}target_scaler.pkl')
        joblib.dump(self.feature_columns, f'{path}feature_columns.pkl')
    
    def load_scalers(self, path='saved_models/'):
        """Load saved scalers"""
        self.feature_scaler = joblib.load(f'{path}feature_scaler.pkl')
        self.target_scaler = joblib.load(f'{path}target_scaler.pkl')
        self.feature_columns = joblib.load(f'{path}feature_columns.pkl')
