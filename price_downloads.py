import time
import random
import logging
import os
from datetime import date, timedelta, datetime

import pandas as pd
import yfinance as yf
from sqlalchemy import create_engine, text

# =====================================================
# CONFIGURATION
# =====================================================

DB_URL = "postgresql+psycopg2://postgres:admin@localhost:5432/market_data"

START_DATE = "2015-04-01"
SLEEP_MIN = 3
SLEEP_MAX = 6

LOG_DIR = "logs"

# =====================================================
# LOGGING SETUP
# =====================================================

os.makedirs(LOG_DIR, exist_ok=True)

log_file = os.path.join(
    LOG_DIR,
    f"stock_ingestion_{datetime.now().date()}.log"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(log_file, mode="a", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# =====================================================
# DATABASE ENGINE
# =====================================================

engine = create_engine(DB_URL, pool_pre_ping=True)

# =====================================================
# HELPER FUNCTIONS
# =====================================================

def get_symbols(conn):
    query = text("SELECT ysymbol FROM stock_master ORDER BY ysymbol")
    return [row[0] for row in conn.execute(query)]

def normalize_symbol(yf_symbol):
    """
    Convert yfinance symbol (e.g., 20MICRONS.NS) to DB symbol (20MICRONS)
    """
    return yf_symbol.replace(".NS", "")

def get_last_trade_date(conn, symbol):
    query = text("""
        SELECT MAX(trade_date)
        FROM stock_prices
        WHERE symbol = :symbol
    """)
    return conn.execute(query, {"symbol": symbol}).scalar()


def preprocess_yf_data(df, yf_symbol):
    """
    Normalize yfinance dataframe into DB-ready format
    """

    if df.empty:
        return df

    # Remove yfinance MultiIndex columns
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.droplevel(1)

    # Reset index to bring Date as column
    df = df.reset_index()

    # Store symbol WITHOUT .NS for DB
    df["symbol"] = normalize_symbol(yf_symbol)

    # Rename columns to match DB schema
    df = df.rename(columns={
        "Date": "trade_date",
        "Open": "open_price",
        "Close": "close_price",
        "High": "high_price",
        "Low": "low_price",
        "Volume": "volume"
    })

    # Keep only required columns
    df = df[[
        "symbol",
        "trade_date",
        "open_price",
        "close_price",
        "high_price",
        "low_price",
        "volume"
    ]]

    return df



def download_and_insert(symbol):
    try:
        with engine.begin() as conn:
            last_date = get_last_trade_date(conn, symbol)

        if last_date:
            start = last_date + timedelta(days=1)
        else:
            start = pd.to_datetime(START_DATE)

        if start.date() >= date.today():
            logger.info(f"{symbol} already up to date")
            return

        logger.info(f"Downloading {symbol} from {start.date()}")

        df = yf.download(
            symbol,
            start=start,
            end=date.today() + timedelta(days=1),
            progress=False,
            auto_adjust=False
        )

        df = preprocess_yf_data(df, symbol)

        if df.empty:
            logger.warning(f"No data after preprocessing for {symbol}")
            return

        insert_sql = """
            INSERT INTO stock_prices (
                symbol,
                trade_date,
                open_price,
                close_price,
                high_price,
                low_price,
                volume
            )
            VALUES (
                :symbol,
                :trade_date,
                :open_price,
                :close_price,
                :high_price,
                :low_price,
                :volume
            )
            ON CONFLICT (symbol, trade_date)
            DO UPDATE SET
                open_price  = EXCLUDED.open_price,
                close_price = EXCLUDED.close_price,
                high_price  = EXCLUDED.high_price,
                low_price   = EXCLUDED.low_price,
                volume      = EXCLUDED.volume;
        """

        with engine.begin() as conn:
            conn.execute(text(insert_sql), df.to_dict("records"))

        logger.info(f"Inserted {len(df)} rows for {symbol}")

    except Exception:
        logger.exception(f"Failed processing {symbol}")


# =====================================================
# MAIN EXECUTION
# =====================================================

def main():
    logger.info("===== STOCK PRICE INGESTION STARTED =====")

    with engine.connect() as conn:
        symbols = get_symbols(conn)

    logger.info(f"Total symbols to process: {len(symbols)}")

    for symbol in symbols:
        download_and_insert(symbol)

        sleep_time = random.randint(SLEEP_MIN, SLEEP_MAX)
        logger.info(f"Sleeping for {sleep_time} seconds\n")
        time.sleep(sleep_time)

    logger.info("===== STOCK PRICE INGESTION COMPLETED =====")


if __name__ == "__main__":
    main()
