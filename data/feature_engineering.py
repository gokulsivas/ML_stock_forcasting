import pandas as pd
import numpy as np
from ta.trend import SMAIndicator, EMAIndicator, MACD
from ta.momentum import RSIIndicator, StochasticOscillator
from ta.volatility import BollingerBands, AverageTrueRange
from ta.volume import OnBalanceVolumeIndicator


class FeatureEngineer:
    """Compute technical indicators for stock data"""
    
    def __init__(self):
        self.feature_columns = []
    
    def add_technical_indicators(self, df):
        """
        Add all technical indicators to dataframe
        df must have: open_price, high_price, low_price, close_price, volume
        """
        df = df.copy()
        close = df['close_price']
        high = df['high_price']
        low = df['low_price']
        volume = df['volume']
        
        # Price-based features
        df['returns'] = close.pct_change()
        df['log_returns'] = np.log(close / close.shift(1))
        df['high_low_spread'] = (high - low) / close
        df['open_close_spread'] = (df['open_price'] - close) / close
        
        # Moving Averages
        df['sma_20'] = SMAIndicator(close, window=20).sma_indicator()
        df['sma_50'] = SMAIndicator(close, window=50).sma_indicator()
        df['sma_200'] = SMAIndicator(close, window=200).sma_indicator()
        df['ema_12'] = EMAIndicator(close, window=12).ema_indicator()
        df['ema_26'] = EMAIndicator(close, window=26).ema_indicator()
        
        # MACD
        macd = MACD(close)
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_diff'] = macd.macd_diff()
        
        # RSI
        df['rsi'] = RSIIndicator(close, window=14).rsi()
        
        # Stochastic Oscillator
        stoch = StochasticOscillator(high, low, close)
        df['stoch_k'] = stoch.stoch()
        df['stoch_d'] = stoch.stoch_signal()
        
        # Bollinger Bands
        bollinger = BollingerBands(close)
        df['bb_high'] = bollinger.bollinger_hband()
        df['bb_low'] = bollinger.bollinger_lband()
        df['bb_mid'] = bollinger.bollinger_mavg()
        df['bb_width'] = (df['bb_high'] - df['bb_low']) / df['bb_mid']
        
        # ATR
        df['atr'] = AverageTrueRange(high, low, close).average_true_range()
        
        # OBV
        df['obv'] = OnBalanceVolumeIndicator(close, volume).on_balance_volume()
        
        # Volume features
        df['volume_change'] = volume.pct_change()
        df['volume_sma_20'] = volume.rolling(window=20).mean()
        
                # Replace infinite values with NaN, then drop
        df = df.replace([np.inf, -np.inf], np.nan)
        
        # Drop NaN rows created by indicators
        df = df.dropna()
        
        return df

    
    def get_feature_columns(self, df):
        """Return list of feature columns (excluding symbol, date, target)"""
        exclude = ['symbol', 'trade_date', 'close_price']
        return [col for col in df.columns if col not in exclude]
