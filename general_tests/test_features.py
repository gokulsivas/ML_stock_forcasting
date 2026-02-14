from data.data_loader import StockDataLoader

loader = StockDataLoader()
symbols = loader.get_stocks_with_min_history(min_days=1500)

# Load first stock with sufficient history
test_symbol = symbols[0]
print(f"Testing with: {test_symbol}")

df = loader.load_stock_data(test_symbol, start_date='2015-01-01')
print(f"\nData shape: {df.shape}")
print(f"Date range: {df['trade_date'].min()} to {df['trade_date'].max()}")
print(f"\nFeatures created: {len(df.columns)}")
print(df.columns.tolist())
print(f"\nFirst few rows:\n{df.head()}")
print(f"\nMissing values:\n{df.isnull().sum()}")
