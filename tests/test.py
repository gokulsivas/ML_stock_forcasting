import yfinance as yf
from datetime import date, time, timedelta
import pandas as pd

import yfinance as yf

# Download data
df = yf.download("OLAELEC.NS", start="2026-01-01", end="2026-01-08")

df.columns = df.columns.droplevel(1)

# Reset index to bring Date as a column
df = df.reset_index()

# Add Ticker column
df["Ticker"] = "OLAELEC.NS"

# Reorder columns
df = df[["Ticker", "Date", "Open", "Close", "High", "Low", "Volume"]]

print(df.head())
