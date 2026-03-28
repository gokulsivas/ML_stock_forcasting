import yfinance as yf
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import logging
from datetime import datetime, timedelta
import time

engine = create_engine("postgresql+psycopg2://postgres:admin@localhost:5432/market_data", pool_pre_ping=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger(__name__)


def get_symbols():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT DISTINCT symbol FROM stock_prices ORDER BY symbol"))
        return [row[0] for row in result]


def get_last_date(symbol):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT MAX(trade_date) FROM stock_prices WHERE symbol = :sym"),
            {"sym": symbol}
        )
        row = result.fetchone()
        return pd.to_datetime(row[0]).date() if row[0] else None


def compute_features(df):
    df = df.copy()
    df['sma5']        = df['close_price'].rolling(5).mean()
    df['sma10']       = df['close_price'].rolling(10).mean()
    df['sma20']       = df['close_price'].rolling(20).mean()
    df['sma50']       = df['close_price'].rolling(50).mean()
    df['ema12']       = df['close_price'].ewm(span=12).mean()
    df['ema26']       = df['close_price'].ewm(span=26).mean()
    df['macd']        = df['ema12'] - df['ema26']
    df['macd_signal'] = df['macd'].ewm(span=9).mean()
    delta = df['close_price'].diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    df['rsi'] = 100 - (100 / (1 + gain / (loss + 1e-10)))
    df['bb_middle'] = df['close_price'].rolling(20).mean()
    bb_std = df['close_price'].rolling(20).std()
    df['bb_upper'] = df['bb_middle'] + 2 * bb_std
    df['bb_lower'] = df['bb_middle'] - 2 * bb_std
    df['tr'] = np.maximum(df['high_price'] - df['low_price'],
               np.maximum(abs(df['high_price'] - df['close_price'].shift(1)),
                          abs(df['low_price']  - df['close_price'].shift(1))))
    df['atr'] = df['tr'].rolling(14).mean()
    df['vwap'] = (df['close_price'] * df['volume']).cumsum() / (df['volume'].cumsum() + 1e-10)
    obv = [0]
    for i in range(1, len(df)):
        if df['close_price'].iloc[i] > df['close_price'].iloc[i-1]:
            obv.append(obv[-1] + df['volume'].iloc[i])
        elif df['close_price'].iloc[i] < df['close_price'].iloc[i-1]:
            obv.append(obv[-1] - df['volume'].iloc[i])
        else:
            obv.append(obv[-1])
    df['obv'] = obv
    low14  = df['low_price'].rolling(14).min()
    high14 = df['high_price'].rolling(14).max()
    df['stoch_k'] = 100 * (df['close_price'] - low14) / (high14 - low14 + 1e-10)
    df['stoch_d'] = df['stoch_k'].rolling(3).mean()
    df['adx']     = df['atr'].rolling(14).mean()
    tp = (df['high_price'] + df['low_price'] + df['close_price']) / 3
    df['cci']   = (tp - tp.rolling(20).mean()) / (0.015 * tp.rolling(20).std() + 1e-10)
    df['willr'] = -100 * (high14 - df['close_price']) / (high14 - low14 + 1e-10)
    df['roc']   = df['close_price'].pct_change(10) * 100
    mf  = tp * df['volume']
    pmf = mf.where(tp > tp.shift(1), 0).rolling(14).sum()
    nmf = mf.where(tp < tp.shift(1), 0).rolling(14).sum()
    df['mfi'] = 100 - (100 / (1 + pmf / (nmf + 1e-10)))
    mfv = ((df['close_price'] - df['low_price']) - (df['high_price'] - df['close_price'])) / (df['high_price'] - df['low_price'] + 1e-10) * df['volume']
    df['cmf'] = mfv.rolling(20).sum() / (df['volume'].rolling(20).sum() + 1e-10)
    vol_ema12 = df['volume'].ewm(span=12).mean()
    vol_ema26 = df['volume'].ewm(span=26).mean()
    df['ppo']  = ((df['ema12'] - df['ema26']) / (df['ema26'] + 1e-10)) * 100
    df['pvo']  = ((vol_ema12 - vol_ema26) / (vol_ema26 + 1e-10)) * 100
    df['trix'] = df['close_price'].ewm(span=15).mean().pct_change() * 100
    df['dpo']  = df['close_price'] - df['close_price'].shift(11).rolling(20).mean()
    df['kst']  = df['roc'] + df['roc'].rolling(10).mean()
    return df


def update_stock(symbol):
    last_date = get_last_date(symbol)
    if last_date is None:
        logger.warning(f"No existing data for {symbol}, skipping")
        return 0

    today = datetime.now().date()
    if last_date >= today - timedelta(days=1):
        return 0

    context_start = last_date - timedelta(days=90)

    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        df_raw = ticker.history(
            start=context_start.strftime('%Y-%m-%d'),
            end=today.strftime('%Y-%m-%d')
        )

        if df_raw.empty:
            logger.warning(f"No data from yfinance for {symbol}")
            return 0

        df_raw = df_raw.reset_index()
        df_raw.columns = [c[0] if isinstance(c, tuple) else c for c in df_raw.columns]
        df_raw = df_raw.rename(columns={
            'Date': 'trade_date', 'Open': 'open_price', 'High': 'high_price',
            'Low': 'low_price', 'Close': 'close_price', 'Volume': 'volume'
        })
        df_raw['trade_date'] = pd.to_datetime(df_raw['trade_date']).dt.date
        df_raw['symbol'] = symbol
        df_raw = df_raw[['symbol', 'trade_date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']].dropna()

        new_rows = df_raw[df_raw['trade_date'] > last_date].copy()

        if new_rows.empty:
            return 0

        new_rows.to_sql('stock_prices', engine, if_exists='append', index=False)
        return len(new_rows)

    except Exception as e:
        logger.error(f"Error updating {symbol}: {e}")
        return 0

def main():
    logger.info("===== INCREMENTAL STOCK UPDATE STARTED =====")
    symbols = get_symbols()
    logger.info(f"Total symbols: {len(symbols)}")

    total_new_rows = 0
    updated_count  = 0
    failed_count   = 0

    for i, symbol in enumerate(symbols):
        try:
            new_rows = update_stock(symbol)
            if new_rows > 0:
                total_new_rows += new_rows
                updated_count  += 1
                logger.info(f"[{i+1}/{len(symbols)}] {symbol}: +{new_rows} rows")
            time.sleep(0.5)
        except Exception as e:
            failed_count += 1
            logger.error(f"[{i+1}/{len(symbols)}] {symbol}: FAILED - {e}")
            time.sleep(1)

    logger.info(f"===== DONE | Updated: {updated_count} | New rows: {total_new_rows} | Failed: {failed_count} =====")


if __name__ == "__main__":
    main()