import { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

function Watchlist() {
  const [stocks, setStocks] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [predictions, setPredictions] = useState({});
  const [error, setError] = useState(null);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    const savedWatchlist = localStorage.getItem('stockWatchlist');
    if (savedWatchlist) {
      try {
        setWatchlist(JSON.parse(savedWatchlist));
      } catch (e) {
        console.error('Failed to load watchlist');
      }
    }
  }, []);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    if (watchlist.length > 0) {
      localStorage.setItem('stockWatchlist', JSON.stringify(watchlist));
    } else {
      localStorage.removeItem('stockWatchlist');
    }
  }, [watchlist]);

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    setLoadingStocks(true);
    try {
      const response = await axios.get(`${API_URL}/api/stocks/`);
      const stockOptions = response.data.map(stock => ({
        value: stock.symbol,
        label: stock.symbol
      }));
      setStocks(stockOptions);
    } catch (err) {
      setError('Failed to fetch stocks');
    } finally {
      setLoadingStocks(false);
    }
  };

  const addToWatchlist = () => {
    if (selectedStock && !watchlist.find(s => s.value === selectedStock.value)) {
      setWatchlist([...watchlist, selectedStock]);
      setSelectedStock(null);
    }
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(watchlist.filter(s => s.value !== symbol));
    // Remove prediction for removed stock
    const newPredictions = { ...predictions };
    delete newPredictions[symbol];
    setPredictions(newPredictions);
  };

  const clearWatchlist = () => {
    setWatchlist([]);
    setPredictions({});
  };

  const fetchAllPredictions = async () => {
    if (watchlist.length === 0) return;

    setLoadingPredictions(true);
    setError(null);

    try {
      const predictionPromises = watchlist.map(stock =>
        axios.post(`${API_URL}/api/predict/`, {
          symbol: stock.value,
          days_ahead: 7
        }).then(res => ({ symbol: stock.value, data: res.data }))
      );

      const results = await Promise.all(predictionPromises);
      
      const predictionsMap = {};
      results.forEach(result => {
        predictionsMap[result.symbol] = result.data;
      });
      
      setPredictions(predictionsMap);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch predictions');
    } finally {
      setLoadingPredictions(false);
    }
  };

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      background: '#1e293b',
      borderColor: state.isFocused ? '#3b82f6' : '#334155',
      borderWidth: '2px',
      borderRadius: '12px',
      padding: '0.375rem 0.5rem',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
      '&:hover': { borderColor: '#475569' },
      cursor: 'text',
      minHeight: '50px'
    }),
    menu: (base) => ({
      ...base,
      background: '#1e293b',
      border: '2px solid #334155',
      borderRadius: '12px',
      marginTop: '8px',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
      zIndex: 9999
    }),
    menuList: (base) => ({
      ...base,
      padding: '8px',
      maxHeight: '300px',
      '::-webkit-scrollbar': { width: '8px' },
      '::-webkit-scrollbar-track': { background: '#0f172a', borderRadius: '4px' },
      '::-webkit-scrollbar-thumb': { background: '#475569', borderRadius: '4px' },
      '::-webkit-scrollbar-thumb:hover': { background: '#64748b' }
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? '#3b82f6' : 'transparent',
      color: '#e2e8f0',
      padding: '12px 16px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: state.isSelected ? '600' : '500',
      '&:active': { background: '#2563eb' }
    }),
    singleValue: (base) => ({ ...base, color: '#e2e8f0', fontWeight: '500' }),
    input: (base) => ({ ...base, color: '#e2e8f0' }),
    placeholder: (base) => ({ ...base, color: '#64748b' }),
    dropdownIndicator: (base) => ({ ...base, color: '#64748b', '&:hover': { color: '#94a3b8' } }),
    indicatorSeparator: () => ({ display: 'none' })
  };

  if (loadingStocks) {
    return (
      <div className="p-8">
        <div className="w-full bg-dark-card/50 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-white/10">
          <LoadingSpinner size="large" />
          <p className="text-center text-slate-400 mt-4">Loading stocks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-[fadeIn_0.5s_ease-in]">
      {/* Page Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-200 mb-2">Watchlist</h1>
        <p className="text-slate-400">Track your favorite stocks and get quick predictions</p>
      </div>

      {/* Main Container */}
      <div className="w-full bg-dark-card/50 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-white/10">
        
        {/* Add to Watchlist */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-200 mb-4">Add Stocks to Watchlist</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <Select
                value={selectedStock}
                onChange={setSelectedStock}
                options={stocks.filter(stock => !watchlist.find(w => w.value === stock.value))}
                isSearchable={true}
                placeholder="Search for stocks to add..."
                styles={selectStyles}
                noOptionsMessage={() => "No stocks found"}
              />
            </div>
            <button
              onClick={addToWatchlist}
              disabled={!selectedStock}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/30"
            >
              <Plus size={20} />
              Add
            </button>
          </div>
        </div>

        {/* Watchlist Actions */}
        {watchlist.length > 0 && (
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Star size={24} className="text-yellow-400 fill-yellow-400" />
              <span className="text-slate-200 font-semibold">
                {watchlist.length} {watchlist.length === 1 ? 'stock' : 'stocks'} in watchlist
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={clearWatchlist}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-semibold transition-all duration-300 border border-red-500/30"
              >
                <Trash2 size={18} />
                Clear All
              </button>
              <button
                onClick={fetchAllPredictions}
                disabled={loadingPredictions}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold transition-all duration-300 hover:shadow-[0_10px_25px_-5px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPredictions ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <TrendingUp size={18} />
                    Get Predictions
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-5 py-4 rounded-xl mb-6 font-medium flex items-center gap-3">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Empty State */}
        {watchlist.length === 0 && (
          <div className="text-center py-16">
            <Star size={64} className="mx-auto mb-4 text-slate-600" />
            <h3 className="text-2xl font-bold text-slate-300 mb-2">Your Watchlist is Empty</h3>
            <p className="text-slate-400">Add stocks to track and get quick predictions</p>
          </div>
        )}

        {/* Watchlist Grid */}
        {watchlist.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {watchlist.map((stock) => {
              const prediction = predictions[stock.value];
              const hasPrediction = !!prediction;
              
              let change = 0;
              let predictedPrice = 0;
              
              if (hasPrediction) {
                const lastPred = prediction.predictions[prediction.predictions.length - 1];
                predictedPrice = lastPred.predicted_price;
                change = ((predictedPrice - prediction.current_price) / prediction.current_price * 100);
              }

              return (
                <div
                  key={stock.value}
                  className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] hover:border-blue-500/40"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Star size={20} className="text-yellow-400 fill-yellow-400" />
                      <h3 className="text-xl font-bold text-slate-200">{stock.value}</h3>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(stock.value)}
                      className="text-slate-400 hover:text-red-400 transition-colors"
                      title="Remove from watchlist"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Prediction Data */}
                  {loadingPredictions && !hasPrediction ? (
                    <div className="py-8">
                      <LoadingSpinner size="small" />
                    </div>
                  ) : hasPrediction ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Current Price</span>
                        <span className="text-slate-200 font-semibold text-lg">
                          ₹{prediction.current_price.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">7-Day Prediction</span>
                        <span className="text-slate-200 font-semibold text-lg">
                          ₹{predictedPrice.toFixed(2)}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-sm">Expected Change</span>
                          <div className="flex items-center gap-2">
                            {change >= 0 ? (
                              <TrendingUp size={20} className="text-green-400" />
                            ) : (
                              <TrendingDown size={20} className="text-red-400" />
                            )}
                            <span className={`font-bold text-xl ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Recommendation */}
                      <div className="pt-3">
                        <div className={`px-4 py-2 rounded-lg text-center font-semibold ${
                          change > 5 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          change > 2 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          change > -2 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          change > -5 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {change > 5 ? 'Strong Buy' :
                           change > 2 ? 'Buy' :
                           change > -2 ? 'Hold' :
                           change > -5 ? 'Sell' :
                           'Strong Sell'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400">
                      <p className="text-sm">Click "Get Predictions" to see forecast</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Watchlist;
