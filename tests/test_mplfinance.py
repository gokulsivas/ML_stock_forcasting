import mplfinance as mpf
import pandas as pd
import yfinance as yf

df = yf.download("OLAELEC.NS", period="6mo")

df.columns = df.columns.droplevel(1)
df = df.reset_index()
df["Ticker"] = "OLAELEC.NS"

df["Date"] = pd.to_datetime(df["Date"])
df.set_index("Date", inplace=True)

print(df.head())
print(df.index)
print(df.index.dtype)


import mplfinance as mpf

mpf.plot(
    df,
    type="candle",
    volume=True,
    mav=(20, 50),
    style="yahoo",
    datetime_format="%Y-%m-%d",
    xrotation=20,
    show_nontrading=False,
)
