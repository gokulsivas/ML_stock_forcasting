# data/data_loader.py

import pandas as pd
import numpy as np
import pywt
from sqlalchemy import create_engine, text
from data.feature_engineering import FeatureEngineer


def wavelet_denoise(series: np.ndarray, wavelet: str = 'db4', level: int = 3) -> np.ndarray:
    """
    Remove high-frequency noise via Discrete Wavelet Transform (Donoho soft-thresholding).
    Preserves directional trend structure while eliminating microstructure noise.
    """
    coeffs = pywt.wavedec(series, wavelet, level=level)
    # Robust noise estimate from finest detail level (MAD estimator)
    sigma = np.median(np.abs(coeffs[-1])) / 0.6745
    # Universal threshold: sqrt(2 * log(N)) * sigma
    threshold = sigma * np.sqrt(2 * np.log(len(series)))
    # Soft-threshold all detail coefficients; leave approximation untouched
    coeffs_thresh = [coeffs[0]] + [
        pywt.threshold(c, threshold, mode='soft') for c in coeffs[1:]
    ]
    denoised = pywt.waverec(coeffs_thresh, wavelet)
    return denoised[:len(series)]   # waverec may add 1 extra sample, trim it


class StockDataLoader:
    """Load stock data from PostgreSQL, denoise, and prepare features"""

    def __init__(self, db_url="postgresql+psycopg2://postgres:admin@localhost:5432/market_data"):
        self.engine = create_engine(db_url)
        self.feature_engineer = FeatureEngineer()

    def load_stock_data(self, symbol, start_date='2015-01-01'):
        """Load single stock, denoise OHLCV, then add all features"""
        query = text("""
            SELECT symbol, trade_date, open_price, high_price,
                   low_price, close_price, volume
            FROM stock_prices
            WHERE symbol = :symbol
              AND trade_date >= :start_date
            ORDER BY trade_date ASC
        """)

        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                'symbol': symbol, 'start_date': start_date
            })

        if df.empty:
            return None

        # ── Wavelet denoising on raw OHLCV BEFORE feature engineering ──────────
        # db4 level=3 needs at least ~32 rows; all real stocks have thousands
        if len(df) >= 32:
            df['close_price'] = wavelet_denoise(df['close_price'].values)
            df['volume']      = wavelet_denoise(df['volume'].values)
            # Denoising can produce tiny negatives on volume; clamp to 0
            df['volume'] = df['volume'].clip(lower=0)

        # Add technical indicators (now computed on denoised price/volume)
        df = self.feature_engineer.add_technical_indicators(df)

        # Add extra directional features
        df = self._add_extra_features(df)

        return df

    def _add_extra_features(self, df):
        """Directional-specific features — added AFTER technical indicators"""

        # Multi-day momentum (strongest directional signals per NSE research)
        df['return_1d']  = df['close_price'].pct_change(1)
        df['return_3d']  = df['close_price'].pct_change(3)
        df['return_5d']  = df['close_price'].pct_change(5)
        df['return_10d'] = df['close_price'].pct_change(10)
        df['return_20d'] = df['close_price'].pct_change(20)

        # Volume spike — unusual volume precedes directional continuation
        df['volume_ratio'] = df['volume'] / (df['volume'].rolling(20).mean() + 1e-8)

        # High-low range as % of close — intraday volatility proxy
        df['hl_range_pct'] = (df['high_price'] - df['low_price']) / (df['close_price'] + 1e-8)

        # Close position within day's range (0 = at low, 1 = at high)
        hl = df['high_price'] - df['low_price'] + 1e-8
        df['close_position'] = (df['close_price'] - df['low_price']) / hl

        # Calendar features — day-of-week and month seasonality
        trade_date = pd.to_datetime(df['trade_date'])
        df['day_of_week'] = trade_date.dt.dayofweek   # 0=Mon, 4=Fri
        df['month']       = trade_date.dt.month        # 1-12

        # 52-week position (0 = near 52w low, 1 = near 52w high)
        roll_min = df['close_price'].rolling(252, min_periods=60).min()
        roll_max = df['close_price'].rolling(252, min_periods=60).max()
        df['52w_position'] = (df['close_price'] - roll_min) / (roll_max - roll_min + 1e-8)

        # Open gap — previous-close to open gap is the #1 directional signal
        df['open_gap'] = (
            (df['open_price'] - df['close_price'].shift(1))
            / (df['close_price'].shift(1) + 1e-8)
        )

        return df

    def get_all_symbols(self):
        """Get list of all symbols"""
        query = text("SELECT DISTINCT symbol FROM stock_master ORDER BY symbol")
        with self.engine.connect() as conn:
            result = conn.execute(query)
            return [row[0] for row in result]

    def get_stocks_with_min_history(self, min_days=1500):
        """Get symbols with at least min_days of data"""
        query = text("""
            SELECT symbol, COUNT(*) as days
            FROM stock_prices
            GROUP BY symbol
            HAVING COUNT(*) >= :min_days
            ORDER BY symbol
        """)
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'min_days': min_days})
        return df['symbol'].tolist()