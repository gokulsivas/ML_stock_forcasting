import { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Plus, X, BarChart3, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTheme } from '../context/ThemeContext';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function Comparison() {
  const { theme } = useTheme();
  const [stocks, setStocks] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [daysAhead, setDaysAhead] = useState(30);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [error, setError] = useState(null);
  const [currentStock, setCurrentStock] = useState(null);

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

  const addStock = () => {
    if (currentStock && !selectedStocks.find(s => s.value === currentStock.value)) {
      setSelectedStocks([...selectedStocks, currentStock]);
      setCurrentStock(null);
    }
  };

  const removeStock = (stockToRemove) => {
    setSelectedStocks(selectedStocks.filter(s => s.value !== stockToRemove.value));
    setPredictions(predictions.filter(p => p.symbol !== stockToRemove.value));
  };

  const compareStocks = async () => {
    if (selectedStocks.length === 0) {
      setError('Please select at least one stock');
      return;
    }

    setLoading(true);
    setError(null);
    const newPredictions = [];

    try {
      for (const stock of selectedStocks) {
        const response = await axios.post(`${API_URL}/api/predict/`, {
          symbol: stock.value,
          days_ahead: daysAhead
        });
        newPredictions.push({
          symbol: stock.value,
          ...response.data
        });
      }
      setPredictions(newPredictions);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch predictions');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setSelectedStocks([]);
    setPredictions([]);
    setError(null);
  };

  const prepareChartData = () => {
    if (predictions.length === 0) return [];

    const allDates = new Set();
    predictions.forEach(pred => {
      allDates.add(pred.current_date);
      pred.predictions.forEach(p => allDates.add(p.date));
    });

    const sortedDates = Array.from(allDates).sort();
    
    return sortedDates.map(date => {
      const dataPoint = { date };
      predictions.forEach(pred => {
        if (date === pred.current_date) {
          dataPoint[pred.symbol] = pred.current_price;
        } else {
          const prediction = pred.predictions.find(p => p.date === date);
          if (prediction) {
            dataPoint[pred.symbol] = prediction.predicted_price;
          }
        }
      });
      return dataPoint;
    });
  };

  const exportComparison = (format) => {
    if (predictions.length === 0) return;

    if (format === 'csv') {
      const csvData = [
        ['Stock Comparison Report'],
        ['Generated On', new Date().toLocaleString()],
        ['Prediction Days', daysAhead],
        [''],
        ['Stock', 'Current Price', 'Predicted Price', 'Change (%)', 'Recommendation']
      ];

      predictions.forEach(pred => {
        const lastPred = pred.predictions[pred.predictions.length - 1];
        const change = ((lastPred.predicted_price - pred.current_price) / pred.current_price * 100).toFixed(2);
        const recommendation = change > 5 ? 'Strong Buy' : change > 2 ? 'Buy' : change > -2 ? 'Hold' : change > -5 ? 'Sell' : 'Strong Sell';
        
        csvData.push([
          pred.symbol,
          pred.current_price.toFixed(2),
          lastPred.predicted_price.toFixed(2),
          change,
          recommendation
        ]);
      });

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `stock_comparison_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      const wb = XLSX.utils.book_new();

      const summaryData = [
        ['Stock', 'Current Price', 'Predicted Price', 'Change (%)', 'Recommendation']
      ];

      predictions.forEach(pred => {
        const lastPred = pred.predictions[pred.predictions.length - 1];
        const change = ((lastPred.predicted_price - pred.current_price) / pred.current_price * 100).toFixed(2);
        const recommendation = change > 5 ? 'Strong Buy' : change > 2 ? 'Buy' : change > -2 ? 'Hold' : change > -5 ? 'Sell' : 'Strong Sell';
        
        summaryData.push([
          pred.symbol,
          pred.current_price,
          lastPred.predicted_price,
          parseFloat(change),
          recommendation
        ]);
      });

      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

      predictions.forEach(pred => {
        const stockData = [
          ['Date', 'Predicted Price', 'Daily Return (%)']
        ];

        pred.predictions.forEach(p => {
          stockData.push([p.date, p.predicted_price, p.predicted_return]);
        });

        const stockWS = XLSX.utils.aoa_to_sheet(stockData);
        XLSX.utils.book_append_sheet(wb, stockWS, pred.symbol.substring(0, 31));
      });

      XLSX.writeFile(wb, `stock_comparison_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  const chartData = prepareChartData();

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      background: theme === 'light' ? '#ffffff' : '#1e293b',
      borderColor: state.isFocused ? '#3b82f6' : (theme === 'light' ? '#e2e8f0' : '#334155'),
      borderWidth: '2px',
      borderRadius: '12px',
      padding: '0.375rem 0.5rem',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
      '&:hover': {
        borderColor: theme === 'light' ? '#cbd5e1' : '#475569'
      }
    }),
    menu: (base) => ({
      ...base,
      background: theme === 'light' ? '#ffffff' : '#1e293b',
      border: `2px solid ${theme === 'light' ? '#e2e8f0' : '#334155'}`,
      borderRadius: '12px',
      marginTop: '8px',
      overflow: 'hidden',
      boxShadow: theme === 'light' ? '0 10px 40px rgba(0, 0, 0, 0.1)' : '0 10px 40px rgba(0, 0, 0, 0.5)'
    }),
    menuList: (base) => ({
      ...base,
      padding: '8px',
      maxHeight: '300px',
      '::-webkit-scrollbar': {
        width: '8px'
      },
      '::-webkit-scrollbar-track': {
        background: theme === 'light' ? '#f1f5f9' : '#0f172a',
        borderRadius: '4px'
      },
      '::-webkit-scrollbar-thumb': {
        background: theme === 'light' ? '#cbd5e1' : '#475569',
        borderRadius: '4px'
      }
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? '#3b82f6' : 'transparent',
      color: state.isFocused ? '#ffffff' : (theme === 'light' ? '#0f172a' : '#e2e8f0'),
      padding: '12px 16px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: state.isSelected ? '600' : '500'
    }),
    singleValue: (base) => ({
      ...base,
      color: theme === 'light' ? '#0f172a' : '#e2e8f0',
      fontWeight: '500'
    }),
    input: (base) => ({
      ...base,
      color: theme === 'light' ? '#0f172a' : '#e2e8f0'
    }),
    placeholder: (base) => ({
      ...base,
      color: '#64748b'
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: '#64748b'
    }),
    indicatorSeparator: () => ({
      display: 'none'
    })
  };

  if (loadingStocks) {
    return (
      <div className="p-8">
        <div className={`w-full ${
          theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-dark-card/50 border-white/10'
        } backdrop-blur-xl rounded-3xl p-10 shadow-2xl border`}>
          <LoadingSpinner size="large" />
          <p className={`text-center ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} mt-4`}>
            Loading stocks...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-[fadeIn_0.5s_ease-in]">
      <div className="text-center mb-10">
        <h1 className={`text-4xl font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'} mb-2`}>
          Compare Stock Predictions
        </h1>
        <p className={theme === 'light' ? 'text-slate-600' : 'text-slate-400'}>
          Compare multiple stocks side-by-side to find the best investment opportunities
        </p>
      </div>

      <div className={`w-full ${
        theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-dark-card/50 border-white/10'
      } backdrop-blur-xl rounded-3xl p-10 shadow-2xl border`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-end">
          <div className="flex flex-col gap-2">
            <label className={`text-xs font-semibold ${
              theme === 'light' ? 'text-slate-700' : 'text-slate-300'
            } uppercase tracking-wider`}>
              Select Stock
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  value={currentStock}
                  onChange={setCurrentStock}
                  options={stocks}
                  isDisabled={loading}
                  isSearchable={true}
                  placeholder="Search stocks..."
                  styles={selectStyles}
                  noOptionsMessage={() => "No stocks found"}
                />
              </div>
              <button
                onClick={addStock}
                disabled={!currentStock || loading}
                className={`px-4 py-3.5 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                  theme === 'light'
                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                }`}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={`text-xs font-semibold ${
              theme === 'light' ? 'text-slate-700' : 'text-slate-300'
            } uppercase tracking-wider`}>
              Prediction Days
            </label>
            <input 
              type="number" 
              min="1" 
              max="365" 
              value={daysAhead}
              onChange={(e) => setDaysAhead(parseInt(e.target.value))}
              disabled={loading}
              className={`w-full px-4 py-3.5 ${
                theme === 'light' 
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 hover:border-slate-400' 
                  : 'bg-dark-card border-dark-border text-slate-200 focus:border-blue-500 hover:border-dark-hover'
              } border-2 rounded-xl font-medium transition-all duration-300 focus:outline-none focus:bg-${theme === 'light' ? 'white' : '[#0f172a]'} focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] disabled:opacity-50`}
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={compareStocks} 
              disabled={loading || selectedStocks.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold uppercase tracking-wide transition-all duration-300 hover:shadow-[0_15px_35px_-5px_rgba(59,130,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <BarChart3 size={20} />
                  Compare
                </>
              )}
            </button>

            {selectedStocks.length > 0 && (
              <button
                onClick={clearAll}
                disabled={loading}
                className={`px-4 py-3.5 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 ${
                  theme === 'light'
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>

        {selectedStocks.length > 0 && (
          <div className={`${
            theme === 'light' ? 'bg-slate-50/50 border-slate-200' : 'bg-[#0f172a]/50 border-white/5'
          } rounded-2xl p-6 border mb-8`}>
            <h3 className={`text-sm font-semibold ${
              theme === 'light' ? 'text-slate-700' : 'text-slate-300'
            } uppercase tracking-wider mb-4`}>
              Selected Stocks ({selectedStocks.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              {selectedStocks.map((stock, idx) => (
                <div 
                  key={stock.value}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                    theme === 'light'
                      ? 'bg-blue-100 border-blue-300 text-slate-900'
                      : 'bg-blue-500/10 border-blue-500/20 text-slate-200'
                  } border`}
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  ></div>
                  {stock.label}
                  <button
                    onClick={() => removeStock(stock)}
                    disabled={loading}
                    className={`ml-2 transition-colors disabled:opacity-50 ${
                      theme === 'light'
                        ? 'text-slate-500 hover:text-red-600'
                        : 'text-slate-400 hover:text-red-400'
                    }`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-xl mb-6 font-medium">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="large" />
          </div>
        )}

        {!loading && predictions.length > 0 && (
          <>
            <div className={`${
              theme === 'light' ? 'bg-slate-50/50 border-slate-200' : 'bg-[#0f172a]/50 border-white/5'
            } rounded-2xl p-8 border mb-10`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
                  Price Prediction Comparison
                </h2>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => exportComparison('csv')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                      theme === 'light'
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    <Download size={16} />
                    CSV
                  </button>
                  <button
                    onClick={() => exportComparison('excel')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                      theme === 'light'
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#334155'} />
                  <XAxis 
                    dataKey="date" 
                    stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === 'light' ? '#ffffff' : '#1e293b',
                      border: `2px solid ${theme === 'light' ? '#e2e8f0' : '#3b82f6'}`,
                      borderRadius: '12px',
                      padding: '12px',
                      color: theme === 'light' ? '#0f172a' : '#e2e8f0'
                    }}
                  />
                  <Legend />
                  {predictions.map((pred, idx) => (
                    <Line
                      key={pred.symbol}
                      type="monotone"
                      dataKey={pred.symbol}
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {predictions.map((pred, idx) => {
                const lastPred = pred.predictions[pred.predictions.length - 1];
                const change = ((lastPred.predicted_price - pred.current_price) / pred.current_price * 100).toFixed(2);
                const recommendation = change > 5 ? 'Strong Buy' : change > 2 ? 'Buy' : change > -2 ? 'Hold' : change > -5 ? 'Sell' : 'Strong Sell';
                const recommendationColor = 
                  recommendation === 'Strong Buy' ? 'text-green-500' :
                  recommendation === 'Buy' ? 'text-green-400' :
                  recommendation === 'Hold' ? 'text-yellow-500' :
                  recommendation === 'Sell' ? 'text-red-400' : 'text-red-500';

                return (
                  <div 
                    key={pred.symbol}
                    className={`${
                      theme === 'light' 
                        ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 hover:border-blue-300' 
                        : 'bg-gradient-to-br from-blue-500/10 to-purple-600/10 border-blue-500/20 hover:border-blue-500/40'
                    } border p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)]`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-xl font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
                        {pred.symbol}
                      </h3>
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      ></div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className={`text-xs ${
                          theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        } uppercase font-semibold tracking-wider mb-1`}>Current Price</div>
                        <div className={`text-2xl font-bold ${
                          theme === 'light' ? 'text-slate-900' : 'text-slate-200'
                        }`}>₹{pred.current_price.toFixed(2)}</div>
                      </div>

                      <div>
                        <div className={`text-xs ${
                          theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        } uppercase font-semibold tracking-wider mb-1`}>Predicted Price</div>
                        <div className={`text-2xl font-bold ${
                          theme === 'light' ? 'text-slate-900' : 'text-slate-200'
                        }`}>₹{lastPred.predicted_price.toFixed(2)}</div>
                      </div>

                      <div>
                        <div className={`text-xs ${
                          theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        } uppercase font-semibold tracking-wider mb-1`}>Expected Change</div>
                        <div className={`text-2xl font-bold ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {change >= 0 ? '+' : ''}{change}%
                        </div>
                      </div>

                      <div className={`pt-3 border-t ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                        <div className={`text-xs ${
                          theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                        } uppercase font-semibold tracking-wider mb-1`}>Recommendation</div>
                        <div className={`text-lg font-bold ${recommendationColor}`}>
                          <TrendingUp className="inline mr-2" size={18} />
                          {recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Comparison;
