import pandas as pd
from sqlalchemy import create_engine, text
from data.feature_engineering import FeatureEngineer


class StockDataLoader:
    """Load stock data from PostgreSQL and prepare features"""

    def __init__(self, db_url="postgresql+psycopg2://postgres:admin@localhost:5432/market_data"):
        self.engine = create_engine(db_url)
        self.feature_engineer = FeatureEngineer()

    def load_stock_data(self, symbol, start_date='2015-01-01'):
        """Load single stock with all features"""
        query = text("""
            SELECT symbol, trade_date, open_price, high_price, 
                   low_price, close_price, volume
            FROM stock_prices
            WHERE symbol = :symbol 
              AND trade_date >= :start_date
            ORDER BY trade_date ASC
        """)

        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'symbol': symbol, 'start_date': start_date})

        if df.empty:
            return None

        # Add technical indicators
        df = self.feature_engineer.add_technical_indicators(df)

        # --- NEW: Extra features for better directional accuracy ---
        df = self._add_extra_features(df)

        return df

    def _add_extra_features(self, df):
        """Add lag returns, volume spike, calendar and position features"""

        # Lag returns — short-term momentum signals
        df['return_1d']  = df['close_price'].pct_change(1)
        df['return_3d']  = df['close_price'].pct_change(3)
        df['return_5d']  = df['close_price'].pct_change(5)
        df['return_10d'] = df['close_price'].pct_change(10)
        df['return_20d'] = df['close_price'].pct_change(20)

        # Volume spike — unusual volume often precedes direction continuation
        df['volume_ratio'] = df['volume'] / (df['volume'].rolling(20).mean() + 1e-8)

        # High-low range as % of close — measures intraday volatility
        df['hl_range_pct'] = (df['high_price'] - df['low_price']) / (df['close_price'] + 1e-8)

        # Close position within day's range (0 = closed at low, 1 = closed at high)
        hl = df['high_price'] - df['low_price'] + 1e-8
        df['close_position'] = (df['close_price'] - df['low_price']) / hl

        # Calendar features — day-of-week and month seasonality
        trade_date = pd.to_datetime(df['trade_date'])
        df['day_of_week'] = trade_date.dt.dayofweek   # 0=Mon, 4=Fri
        df['month']       = trade_date.dt.month        # 1–12

        # 52-week position (0 = near 52w low, 1 = near 52w high)
        roll_min = df['close_price'].rolling(252, min_periods=60).min()
        roll_max = df['close_price'].rolling(252, min_periods=60).max()
        df['52w_position'] = (df['close_price'] - roll_min) / (roll_max - roll_min + 1e-8)

        # Price gap from open (gap up/down at open is directionally significant)
        df['open_gap'] = (df['open_price'] - df['close_price'].shift(1)) / (df['close_price'].shift(1) + 1e-8)

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