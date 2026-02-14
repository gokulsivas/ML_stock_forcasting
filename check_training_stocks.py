from data.data_loader import StockDataLoader

loader = StockDataLoader()
symbols = loader.get_stocks_with_min_history(min_days=1500)

print("First 10 stocks used in training:")
for i, symbol in enumerate(symbols[:10], 1):
    df = loader.load_stock_data(symbol)
    if df is not None:
        price_range = f"₹{df['close_price'].min():.2f} - ₹{df['close_price'].max():.2f}"
        print(f"{i}. {symbol}: {len(df)} days, Price range: {price_range}")
