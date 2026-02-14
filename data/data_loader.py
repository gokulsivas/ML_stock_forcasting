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
        
        return df
    
    def get_all_symbols(self):
        """Get list of all symbols"""
        query = text("SELECT DISTINCT ysymbol FROM stock_master ORDER BY ysymbol")
        
        with self.engine.connect() as conn:
            result = conn.execute(query)
            return [row[0] for row in result]
    
    def get_stocks_with_min_history(self, min_days=1500):
        """Get symbols with at least min_days of data (for 10 years ~2500 days)"""
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
