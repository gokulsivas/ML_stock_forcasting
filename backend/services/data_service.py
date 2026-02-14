from sqlalchemy import text, create_engine

DB_URL = "postgresql+psycopg2://postgres:admin@localhost:5432/market_data"
engine = create_engine(DB_URL, pool_pre_ping=True)


class DataService:
    """Handle database queries for API"""
    
    @staticmethod
    def get_all_stocks():
        """Get all available stocks"""
        with engine.connect() as conn:
            query = text("""
                SELECT DISTINCT symbol, ysymbol
                FROM stock_master
                WHERE symbol IN (
                    SELECT DISTINCT symbol FROM stock_prices
                )
                ORDER BY symbol
                LIMIT 100
            """)
            result = conn.execute(query)
            return [{'symbol': row.symbol, 'ysymbol': row.ysymbol} for row in result]
    
    @staticmethod
    def get_historical_prices(symbol, limit=365):
        """Get recent historical data"""
        with engine.connect() as conn:
            query = text("""
                SELECT trade_date, open_price, high_price, low_price, 
                       close_price, volume
                FROM stock_prices
                WHERE symbol = :symbol
                ORDER BY trade_date DESC
                LIMIT :limit
            """)
            result = conn.execute(query, {'symbol': symbol, 'limit': limit})
            data = [dict(row._mapping) for row in result]
            return list(reversed(data))  # Return chronological order
    
    @staticmethod
    def get_latest_price(symbol):
        """Get most recent price"""
        with engine.connect() as conn:
            query = text("""
                SELECT trade_date, close_price, volume
                FROM stock_prices
                WHERE symbol = :symbol
                ORDER BY trade_date DESC
                LIMIT 1
            """)
            result = conn.execute(query, {'symbol': symbol})
            row = result.fetchone()
            return dict(row._mapping) if row else None
