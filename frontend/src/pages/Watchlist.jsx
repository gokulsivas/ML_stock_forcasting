import { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { Plus, Trash2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

function Watchlist() {
  const { theme }        = useTheme();
  const { authHeaders }  = useAuth();

  const [stocks, setStocks]                   = useState([]);
  const [watchlist, setWatchlist]             = useState([]);
  const [selectedStock, setSelectedStock]     = useState(null);
  const [loadingStocks, setLoadingStocks]     = useState(true);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [predictions, setPredictions]         = useState({});
  const [failedStocks, setFailedStocks]       = useState({});
  const [error, setError]                     = useState(null);

  useEffect(() => {
    fetchStocks();
    fetchWatchlist();
  }, []);

  const fetchStocks = async () => {
    setLoadingStocks(true);
    try {
      const response = await axios.get(`${API_URL}/api/stocks/`);
      setStocks(response.data.map(stock => ({ value: stock.symbol, label: stock.symbol })));
    } catch (err) {
      setError('Failed to fetch stocks');
    } finally {
      setLoadingStocks(false);
    }
  };

  const fetchWatchlist = async () => {
    setLoadingWatchlist(true);
    try {
      const response = await axios.get(`${API_URL}/api/watchlist/`, { headers: authHeaders });
      setWatchlist(response.data.map(item => ({ value: item.symbol, label: item.symbol })));
    } catch (err) {
      setError('Failed to load watchlist');
    } finally {
      setLoadingWatchlist(false);
    }
  };

  const addToWatchlist = async () => {
    if (!selectedStock || watchlist.find(s => s.value === selectedStock.value)) return;
    try {
      await axios.post(`${API_URL}/api/watchlist/${selectedStock.value}`, {}, { headers: authHeaders });
      setWatchlist([...watchlist, selectedStock]);
      setSelectedStock(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add stock');
    }
  };

  const removeFromWatchlist = async (symbol) => {
    try {
      await axios.delete(`${API_URL}/api/watchlist/${symbol}`, { headers: authHeaders });
      setWatchlist(watchlist.filter(s => s.value !== symbol));
      const newPredictions = { ...predictions };
      const newFailed      = { ...failedStocks };
      delete newPredictions[symbol];
      delete newFailed[symbol];
      setPredictions(newPredictions);
      setFailedStocks(newFailed);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove stock');
    }
  };

  const clearWatchlist = async () => {
    try {
      await axios.delete(`${API_URL}/api/watchlist/`, { headers: authHeaders });
      setWatchlist([]);
      setPredictions({});
      setFailedStocks({});
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear watchlist');
    }
  };

  const fetchAllPredictions = async () => {
    if (watchlist.length === 0) return;
    setLoadingPredictions(true);
    setError(null);
    setFailedStocks({});

    const results = await Promise.allSettled(
      watchlist.map(stock =>
        axios.post(`${API_URL}/api/predict/`, { symbol: stock.value, days_ahead: 7 })
          .then(res => ({ symbol: stock.value, data: res.data }))
      )
    );

    const predictionsMap = {};
    const failedMap      = {};
    results.forEach((result, idx) => {
      const symbol = watchlist[idx].value;
      if (result.status === 'fulfilled') {
        predictionsMap[symbol] = result.value.data;
      } else {
        failedMap[symbol] = result.reason?.response?.data?.detail || 'Insufficient data';
      }
    });

    setPredictions(predictionsMap);
    setFailedStocks(failedMap);
    setLoadingPredictions(false);
  };

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      background: theme === 'light' ? '#ffffff' : '#1e293b',
      borderColor: state.isFocused ? '#3b82f6' : (theme === 'light' ? '#e2e8f0' : '#1e293b'),
      borderWidth: '2px',
      borderRadius: '12px',
      padding: '0.25rem 0.5rem',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(59,130,246,0.1)' : 'none',
      '&:hover': { borderColor: theme === 'light' ? '#cbd5e1' : '#334155' },
      cursor: 'text',
      minHeight: '48px'
    }),
    menu: (base) => ({
      ...base,
      background: theme === 'light' ? '#ffffff' : '#1e293b',
      border: `2px solid ${theme === 'light' ? '#e2e8f0' : '#1e293b'}`,
      borderRadius: '12px',
      marginTop: '8px',
      overflow: 'hidden',
      boxShadow: theme === 'light' ? '0 10px 40px rgba(0,0,0,0.1)' : '0 10px 40px rgba(0,0,0,0.6)',
      zIndex: 9999
    }),
    menuList: (base) => ({
      ...base,
      padding: '8px',
      maxHeight: '300px',
      '::-webkit-scrollbar': { width: '8px' },
      '::-webkit-scrollbar-track': { background: theme === 'light' ? '#f1f5f9' : '#0f172a', borderRadius: '4px' },
      '::-webkit-scrollbar-thumb': { background: theme === 'light' ? '#cbd5e1' : '#334155', borderRadius: '4px' },
      '::-webkit-scrollbar-thumb:hover': { background: theme === 'light' ? '#94a3b8' : '#475569' }
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? '#3b82f6' : 'transparent',
      color: state.isFocused ? '#ffffff' : (theme === 'light' ? '#1e293b' : '#e2e8f0'),
      padding: '12px 16px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: state.isSelected ? '600' : '500',
      '&:active': { background: '#2563eb' }
    }),
    singleValue:        (base) => ({ ...base, color: theme === 'light' ? '#1e293b' : '#e2e8f0', fontWeight: '500' }),
    input:              (base) => ({ ...base, color: theme === 'light' ? '#1e293b' : '#e2e8f0' }),
    placeholder:        (base) => ({ ...base, color: '#64748b' }),
    dropdownIndicator:  (base) => ({ ...base, color: '#64748b', '&:hover': { color: '#94a3b8' } }),
    indicatorSeparator: ()     => ({ display: 'none' })
  };

  // ── Shared card style ──────────────────────────────────────────────────────
  const cardClass = `rounded-2xl border backdrop-blur-sm ${
    theme === 'light'
      ? 'bg-white/80 border-slate-200/80 shadow-sm'
      : 'bg-[#1e293b]/60 border-white/10'
  }`;

  if (loadingStocks || loadingWatchlist) {
    return (
      <div className="p-8">
        <div className={`w-full ${cardClass} p-10`}>
          <LoadingSpinner size="large" />
          <p className={`text-center mt-4 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-8 ${
      theme === 'light' ? 'bg-[#f8fafc]' : 'bg-[#060d1a]'
    } animate-[fadeIn_0.5s_ease-in]`}>

      {/* Page header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
          <h1 className={`text-3xl font-black tracking-tight ${
            theme === 'light' ? 'text-slate-900' : 'text-white'
          }`}>Watchlist</h1>
        </div>
        <p className={`ml-5 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
          Track your favourite stocks and get 7-day predictions at a glance
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">

        {/* Add stock card */}
        <div className={`${cardClass} p-6`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
          }`}>Add to Watchlist</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <Select
                value={selectedStock}
                onChange={setSelectedStock}
                options={stocks.filter(s => !watchlist.find(w => w.value === s.value))}
                isSearchable
                placeholder="Search for a stock..."
                styles={{
                  ...selectStyles,
                  menuPortal: (base) => ({ ...base, zIndex: 9999 })
                }}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                noOptionsMessage={() => 'No stocks found'}
              />
            </div>
            <button
              onClick={addToWatchlist}
              disabled={!selectedStock}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl font-bold transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <Plus size={18} /> Add
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-xl font-medium flex items-center gap-3">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Watchlist actions bar */}
        {watchlist.length > 0 && (
          <div className={`${cardClass} px-6 py-4 flex items-center justify-between`}>
            <p className={`text-sm font-semibold ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              <span className={`font-black text-lg mr-1 ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>{watchlist.length}</span>
              {watchlist.length === 1 ? 'stock' : 'stocks'} tracked
            </p>
            <div className="flex gap-2">
              <button
                onClick={clearWatchlist}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${
                  theme === 'light'
                    ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                    : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                }`}
              >
                <Trash2 size={15} /> Clear All
              </button>
              <button
                onClick={fetchAllPredictions}
                disabled={loadingPredictions}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl text-sm font-bold transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPredictions ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <TrendingUp size={15} /> Get Predictions
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {watchlist.length === 0 && (
          <div className={`${cardClass} p-20 text-center`}>
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ${
              theme === 'light' ? 'bg-slate-100' : 'bg-white/5'
            }`}>
              <TrendingUp size={28} className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'} />
            </div>
            <h3 className={`text-xl font-black mb-2 ${
              theme === 'light' ? 'text-slate-700' : 'text-slate-300'
            }`}>Your Watchlist is Empty</h3>
            <p className={`text-sm ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
              Add stocks above to start tracking them
            </p>
          </div>
        )}

        {/* Stock cards grid */}
        {watchlist.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {watchlist.map((stock) => {
              const prediction    = predictions[stock.value];
              const failReason    = failedStocks[stock.value];
              const hasPrediction = !!prediction;
              const hasFailed     = !!failReason;

              let change         = 0;
              let predictedPrice = 0;

              if (hasPrediction) {
                const lastPred = prediction.predictions[prediction.predictions.length - 1];
                predictedPrice = lastPred.predicted_price;
                change = ((predictedPrice - prediction.current_price) / prediction.current_price * 100);
              }

              const recLabel =
                change > 5  ? 'Strong Buy'  :
                change > 2  ? 'Buy'         :
                change > -2 ? 'Hold'        :
                change > -5 ? 'Sell'        : 'Strong Sell';

              const recStyle =
                change > 5  ? (theme === 'light' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
                change > 2  ? (theme === 'light' ? 'bg-emerald-50 text-emerald-500 border-emerald-200'  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
                change > -2 ? (theme === 'light' ? 'bg-amber-50 text-amber-600 border-amber-200'        : 'bg-amber-500/10 text-amber-400 border-amber-500/20')       :
                change > -5 ? (theme === 'light' ? 'bg-red-50 text-red-500 border-red-200'              : 'bg-red-500/10 text-red-400 border-red-500/20')             :
                               (theme === 'light' ? 'bg-red-50 text-red-600 border-red-200'              : 'bg-red-500/10 text-red-400 border-red-500/20');

              return (
                <div
                  key={stock.value}
                  className={`${cardClass} p-6 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.2)]`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className={`text-xl font-black ${
                        theme === 'light' ? 'text-slate-900' : 'text-white'
                      }`}>{stock.value}</h3>
                      <p className={`text-xs mt-0.5 ${
                        theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                      }`}>7-day forecast</p>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(stock.value)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        theme === 'light'
                          ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                          : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                      }`}
                      title="Remove from watchlist"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Loading state */}
                  {loadingPredictions && !hasPrediction && !hasFailed ? (
                    <div className="py-10">
                      <LoadingSpinner size="small" />
                    </div>

                  /* Failed state */
                  ) : hasFailed ? (
                    <div className="py-8 flex flex-col items-center gap-3 text-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        theme === 'light' ? 'bg-slate-100' : 'bg-white/5'
                      }`}>
                        <AlertCircle size={22} className={
                          theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                        } />
                      </div>
                      <p className={`text-sm font-bold ${
                        theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                      }`}>Insufficient Data</p>
                      <p className={`text-xs ${
                        theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                      }`}>Not enough historical data to predict</p>
                    </div>

                  /* Prediction state */
                  ) : hasPrediction ? (
                    <div className="space-y-4">
                      {/* Price row */}
                      <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl ${
                        theme === 'light' ? 'bg-slate-50' : 'bg-white/5'
                      }`}>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                            theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                          }`}>Current</p>
                          <p className={`text-base font-black ${
                            theme === 'light' ? 'text-slate-900' : 'text-white'
                          }`}>₹{prediction.current_price.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                            theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                          }`}>Predicted</p>
                          <p className={`text-base font-black ${
                            theme === 'light' ? 'text-slate-900' : 'text-white'
                          }`}>₹{predictedPrice.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Change row */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold uppercase tracking-widest ${
                          theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                        }`}>Expected Change</span>
                        <div className="flex items-center gap-1.5">
                          {change >= 0
                            ? <TrendingUp size={16} className="text-emerald-500" />
                            : <TrendingDown size={16} className="text-red-500" />}
                          <span className={`text-lg font-black ${
                            change >= 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Recommendation badge */}
                      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border font-bold text-sm ${recStyle}`}>
                        <span className="uppercase tracking-wider text-xs">{recLabel}</span>
                        {change >= 0
                          ? <TrendingUp size={16} />
                          : <TrendingDown size={16} />}
                      </div>
                    </div>

                  /* Idle state */
                  ) : (
                    <div className="py-10 text-center">
                      <p className={`text-sm ${
                        theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                      }`}>Click "Get Predictions" to see forecast</p>
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