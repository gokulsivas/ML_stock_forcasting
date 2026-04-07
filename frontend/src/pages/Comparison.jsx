import { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, Plus, X, BarChart3, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTheme } from '../context/ThemeContext';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function Comparison() {
  const { theme } = useTheme();
  const [stocks, setStocks]               = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [daysAhead, setDaysAhead]         = useState(30);
  const [predictions, setPredictions]     = useState([]);
  const [loading, setLoading]             = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [error, setError]                 = useState(null);
  const [currentStock, setCurrentStock]   = useState(null);

  useEffect(() => { fetchStocks(); }, []);

  const fetchStocks = async () => {
    setLoadingStocks(true);
    try {
      const response = await axios.get(`${API_URL}/api/stocks/`);
      setStocks(response.data.map(s => ({ value: s.symbol, label: s.symbol })));
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

  const removeStock = (stock) => {
    setSelectedStocks(selectedStocks.filter(s => s.value !== stock.value));
    setPredictions(predictions.filter(p => p.symbol !== stock.value));
  };

  const compareStocks = async () => {
    if (selectedStocks.length === 0) { setError('Please select at least one stock'); return; }
    setLoading(true);
    setError(null);
    const newPredictions = [];
    try {
      for (const stock of selectedStocks) {
        const response = await axios.post(`${API_URL}/api/predict/`, {
          symbol: stock.value,
          days_ahead: daysAhead
        });
        newPredictions.push({ symbol: stock.value, ...response.data });
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
    return Array.from(allDates).sort().map(date => {
      const point = { date };
      predictions.forEach(pred => {
        if (date === pred.current_date) {
          point[pred.symbol] = pred.current_price;
        } else {
          const p = pred.predictions.find(p => p.date === date);
          if (p) point[pred.symbol] = p.predicted_price;
        }
      });
      return point;
    });
  };

  const exportComparison = (format) => {
    if (predictions.length === 0) return;
    if (format === 'csv') {
      const rows = [
        ['Stock Comparison Report'],
        ['Generated On', new Date().toLocaleString()],
        ['Prediction Days', daysAhead],
        [''],
        ['Stock', 'Current Price', 'Predicted Price', 'Change (%)', 'Recommendation']
      ];
      predictions.forEach(pred => {
        const last   = pred.predictions[pred.predictions.length - 1];
        const change = ((last.predicted_price - pred.current_price) / pred.current_price * 100).toFixed(2);
        const rec    = change > 5 ? 'Strong Buy' : change > 2 ? 'Buy' : change > -2 ? 'Hold' : change > -5 ? 'Sell' : 'Strong Sell';
        rows.push([pred.symbol, pred.current_price.toFixed(2), last.predicted_price.toFixed(2), change, rec]);
      });
      const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `stock_comparison_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      const wb = XLSX.utils.book_new();
      const summaryData = [['Stock', 'Current Price', 'Predicted Price', 'Change (%)', 'Recommendation']];
      predictions.forEach(pred => {
        const last   = pred.predictions[pred.predictions.length - 1];
        const change = ((last.predicted_price - pred.current_price) / pred.current_price * 100).toFixed(2);
        const rec    = change > 5 ? 'Strong Buy' : change > 2 ? 'Buy' : change > -2 ? 'Hold' : change > -5 ? 'Sell' : 'Strong Sell';
        summaryData.push([pred.symbol, pred.current_price, last.predicted_price, parseFloat(change), rec]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
      predictions.forEach(pred => {
        const data = [['Date', 'Predicted Price', 'Daily Return (%)']];
        pred.predictions.forEach(p => data.push([p.date, p.predicted_price, p.predicted_return]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), pred.symbol.substring(0, 31));
      });
      XLSX.writeFile(wb, `stock_comparison_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  const chartData = prepareChartData();

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
      maxHeight: '280px',
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

  if (loadingStocks) {
    return (
      <div className="p-8">
        <div className={`w-full ${cardClass} p-10`}>
          <LoadingSpinner size="large" />
          <p className={`text-center mt-4 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            Loading stocks...
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
          }`}>
            Compare Stocks
          </h1>
        </div>
        <p className={`ml-5 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
          Side-by-side prediction comparison across multiple NIFTY stocks
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">

        {/* Controls card */}
        <div className={`${cardClass} p-6`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">

            {/* Stock selector + Add button */}
            <div className="flex flex-col gap-2">
              <label className={`text-xs font-bold uppercase tracking-widest ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Add Stock</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={currentStock}
                    onChange={setCurrentStock}
                    options={stocks.filter(s => !selectedStocks.find(ss => ss.value === s.value))}
                    isDisabled={loading}
                    isSearchable
                    placeholder="Search stocks..."
                    styles={selectStyles}
                    noOptionsMessage={() => 'No stocks found'}
                  />
                </div>
                <button
                  onClick={addStock}
                  disabled={!currentStock || loading}
                  className={`px-4 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
                    theme === 'light'
                      ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                  }`}
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* Days input */}
            <div className="flex flex-col gap-2">
              <label className={`text-xs font-bold uppercase tracking-widest ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>Prediction Days</label>
              <input
                type="number"
                min="1"
                max="365"
                value={daysAhead}
                onChange={(e) => setDaysAhead(parseInt(e.target.value))}
                disabled={loading}
                className={`w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 hover:border-slate-300'
                    : 'bg-[#1e293b] border-[#1e293b] text-slate-200 focus:border-blue-500 hover:border-[#334155]'
                }`}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={compareStocks}
                disabled={loading || selectedStocks.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl font-bold transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    <BarChart3 size={18} />
                    Compare
                  </>
                )}
              </button>
              {selectedStocks.length > 0 && (
                <button
                  onClick={clearAll}
                  disabled={loading}
                  className={`px-4 py-3 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 border-2 ${
                    theme === 'light'
                      ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                      : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Selected stock chips */}
          {selectedStocks.length > 0 && (
            <div className={`mt-5 pt-5 border-t ${
              theme === 'light' ? 'border-slate-100' : 'border-white/5'
            }`}>
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                theme === 'light' ? 'text-slate-400' : 'text-slate-500'
              }`}>Selected ({selectedStocks.length})</p>
              <div className="flex flex-wrap gap-2">
                {selectedStocks.map((stock, idx) => (
                  <div
                    key={stock.value}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                      theme === 'light'
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    {stock.label}
                    <button
                      onClick={() => removeStock(stock)}
                      disabled={loading}
                      className={`ml-1 transition-colors disabled:opacity-50 ${
                        theme === 'light' ? 'text-slate-400 hover:text-red-500' : 'text-slate-500 hover:text-red-400'
                      }`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-xl font-medium">
            ⚠ {error}
          </div>
        )}

        {loading && (
          <div className={`${cardClass} p-20 flex items-center justify-center`}>
            <LoadingSpinner size="large" />
          </div>
        )}

        {!loading && predictions.length > 0 && (
          <>
            {/* Chart card */}
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
                  <h2 className={`text-lg font-bold ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>Price Prediction Comparison</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportComparison('csv')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      theme === 'light'
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    <Download size={12} /> CSV
                  </button>
                  <button
                    onClick={() => exportComparison('excel')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      theme === 'light'
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    <FileSpreadsheet size={12} /> Excel
                  </button>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={480}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'}
                  />
                  <XAxis
                    dataKey="date"
                    stroke={theme === 'light' ? '#94a3b8' : '#334155'}
                    style={{ fontSize: '11px' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke={theme === 'light' ? '#94a3b8' : '#334155'}
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'light' ? '#ffffff' : '#1e293b',
                      border: `2px solid ${theme === 'light' ? '#e2e8f0' : '#1e293b'}`,
                      borderRadius: '14px',
                      padding: '12px 16px',
                      color: theme === 'light' ? '#1e293b' : '#e2e8f0',
                      fontSize: '13px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
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
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stock summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {predictions.map((pred, idx) => {
                const last   = pred.predictions[pred.predictions.length - 1];
                const change = ((last.predicted_price - pred.current_price) / pred.current_price * 100).toFixed(2);
                const rec    = change > 5 ? 'Strong Buy' : change > 2 ? 'Buy' : change > -2 ? 'Hold' : change > -5 ? 'Sell' : 'Strong Sell';
                const isUp   = parseFloat(change) >= 0;

                const recStyle =
                  rec === 'Strong Buy'  ? (theme === 'light' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
                  rec === 'Buy'         ? (theme === 'light' ? 'bg-emerald-50 text-emerald-500 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
                  rec === 'Hold'        ? (theme === 'light' ? 'bg-amber-50 text-amber-600 border-amber-200'       : 'bg-amber-500/10 text-amber-400 border-amber-500/20') :
                  rec === 'Sell'        ? (theme === 'light' ? 'bg-red-50 text-red-500 border-red-200'             : 'bg-red-500/10 text-red-400 border-red-500/20') :
                                          (theme === 'light' ? 'bg-red-50 text-red-600 border-red-200'             : 'bg-red-500/10 text-red-400 border-red-500/20');

                return (
                  <div
                    key={pred.symbol}
                    className={`${cardClass} p-6 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.2)]`}
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-10 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <div>
                          <h3 className={`text-xl font-black ${
                            theme === 'light' ? 'text-slate-900' : 'text-white'
                          }`}>{pred.symbol}</h3>
                          <p className={`text-xs ${
                            theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                          }`}>{daysAhead}-day forecast</p>
                        </div>
                      </div>
                      <span className={`text-2xl font-black ${
                        isUp ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {isUp ? '+' : ''}{change}%
                      </span>
                    </div>

                    {/* Price row */}
                    <div className={`grid grid-cols-2 gap-3 mb-5 p-4 rounded-xl ${
                      theme === 'light' ? 'bg-slate-50' : 'bg-white/5'
                    }`}>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                          theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                        }`}>Current</p>
                        <p className={`text-lg font-black ${
                          theme === 'light' ? 'text-slate-900' : 'text-white'
                        }`}>₹{pred.current_price.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                          theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                        }`}>Predicted</p>
                        <p className={`text-lg font-black ${
                          theme === 'light' ? 'text-slate-900' : 'text-white'
                        }`}>₹{last.predicted_price.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Recommendation badge */}
                    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border font-bold text-sm ${recStyle}`}>
                      <span className="uppercase tracking-wider text-xs">{rec}</span>
                      {isUp
                        ? <TrendingUp size={18} />
                        : <TrendingDown size={18} />}
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