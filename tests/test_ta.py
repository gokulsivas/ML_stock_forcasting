import yfinance as yf
import pandas as pd
import ta
import matplotlib.pyplot as plt
import seaborn as sns

# Download sample data
df = yf.download("OLAELEC.NS", period="12mo", progress=False)

df.columns = df.columns.droplevel(1)
df = df.reset_index()
df["Ticker"] = "OLAELEC.NS"

# yfinance returns MultiIndex columns → flatten
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.droplevel(1)

# Calculate 20-day Simple Moving Average
df["SMA_20"] = ta.trend.sma_indicator(df["Close"],window=20)
df["SMA_30"] = ta.trend.sma_indicator(df["Close"],window=30)
df["SMA_Vol_30"] = ta.trend.sma_indicator(df["Volume"],window=30).round(0).astype("Int64")
df["SMA_Vol_200"] = ta.trend.sma_indicator(df["Volume"], window=200).round(0).astype("Int64")

# Show last few rows
print(df[["Ticker", "Date", "Close","Open", "High","Low", "Volume", "SMA_Vol_30","SMA_Vol_200", "SMA_20", "SMA_30"]].tail())

df["Date"] = pd.to_datetime(df["Date"])

import matplotlib.pyplot as plt

df["Date"] = pd.to_datetime(df["Date"])

fig, ax1 = plt.subplots(figsize=(12, 6))

# ---- Volume axis (left) ----
ax1.plot(df["Date"], df["Volume"], label="Volume", alpha=0.4)
ax1.plot(df["Date"], df["SMA_Vol_30"], label="SMA 30 Vol")
ax1.plot(df["Date"], df["SMA_Vol_200"], label="SMA 200 Vol")
ax1.set_xlabel("Date")
ax1.set_ylabel("Volume")

# ---- Price axis (right) ----
ax2 = ax1.twinx()
ax2.plot(df["Date"], df["Close"], color="black", label="Close Price")
ax2.set_ylabel("Price")

# ---- Legends ----
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left")

plt.title("Price and Volume with Moving Averages")
plt.tight_layout()
plt.show()
