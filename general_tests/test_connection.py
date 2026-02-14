from data.data_loader import StockDataLoader

loader = StockDataLoader()
symbols = loader.get_all_symbols()
print(f"Total symbols: {len(symbols)}")
print(f"First 10: {symbols[:10]}")

# Check data quality
stocks_with_history = loader.get_stocks_with_min_history(min_days=1500)
print(f"\nStocks with 1500+ days: {len(stocks_with_history)}")
