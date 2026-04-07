import { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Brush, Area, AreaChart
} from 'recharts';
import { Calendar, DollarSign, Activity, Search, Maximize2, Download, FileSpreadsheet, TrendingUp, TrendingDown } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

function Predictions() {
  const { theme } = useTheme();
  const [stocks, setStocks]               = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [daysAhead, setDaysAhead]         = useState(5);
  const [prediction, setPrediction]       = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [error, setError]                 = useState(null);
  const [daysError, setDaysError]         = useState(null);
  const [chartType, setChartType]         = useState('line');
  const [showBrush, setShowBrush]         = useState(false);

  useEffect(() => { fetchStocks(); }, []);

  const fetchStocks = async () => {
    setLoadingStocks(true);
    try {
      const response = await axios.get(`${API_URL}/api/stocks/`);
      const stockOptions = response.data.map(stock => ({
        value: stock.symbol,
        label: stock.symbol
      }));
      setStocks(stockOptions);
      if (stockOptions.length > 0) setSelectedStock(stockOptions[0]);
    } catch (err) {
      setError('Failed to fetch stocks');
    } finally {
      setLoadingStocks(false);
    }
  };

  const handleDaysChange = (e) => {
    const value = parseInt(e.target.value);
    setDaysAhead(value);
    if (isNaN(value) || value < 1) {
      setDaysError('Please enter a value between 1 and 365.');
    } else if (value > 365) {
      setDaysError('Maximum allowed is 365 days.');
    } else {
      setDaysError(null);
    }
  };

  const fetchPrediction = async () => {
    if (!selectedStock) return;
    if (isNaN(daysAhead) || daysAhead < 1 || daysAhead > 365) {
      setDaysError('Maximum allowed is 365 days. Please enter a value between 1 and 365.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/predict/`, {
        symbol: selectedStock.value,
        days_ahead: daysAhead
      });
      setPrediction(response.data);
      if (daysAhead > 30) setShowBrush(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch prediction');
    } finally {
      setLoading(false);
    }
  };

  const chartData = prediction ? [
    {
      date: prediction.current_date,
      price: prediction.current_price,
      type: 'Current',
      isActual: true
    },
    ...prediction.predictions.map(p => ({
      date: p.date,
      price: p.predicted_price,
      type: 'Predicted',
      return: p.predicted_return,
      isActual: false
    }))
  ] : [];

  const lastPrediction = prediction?.predictions[prediction.predictions.length - 1];
  const totalChange = lastPrediction
    ? ((lastPrediction.predicted_price - prediction.current_price) / prediction.current_price * 100).toFixed(2)
    : 0;

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      background: theme === 'light' ? '#ffffff' : '#1e293b',
      borderColor: state.isFocused ? '#3b82f6' : (theme === 'light' ? '#e2e8f0' : '#1e293b'),
      borderWidth: '2px',
      borderRadius: '12px',
      padding: '0.375rem 0.5rem',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
      '&:hover': { borderColor: theme === 'light' ? '#cbd5e1' : '#334155' },
      cursor: 'text',
      minHeight: '50px'
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
    singleValue: (base) => ({ ...base, color: theme === 'light' ? '#1e293b' : '#e2e8f0', fontWeight: '500' }),
    input:       (base) => ({ ...base, color: theme === 'light' ? '#1e293b' : '#e2e8f0' }),
    placeholder: (base) => ({ ...base, color: '#64748b' }),
    dropdownIndicator: (base) => ({ ...base, color: '#64748b', '&:hover': { color: '#94a3b8' } }),
    indicatorSeparator: () => ({ display: 'none' })
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`border-2 rounded-2xl p-4 shadow-2xl backdrop-blur-sm ${
          theme === 'light'
            ? 'bg-white/95 border-blue-200'
            : 'bg-[#1e293b]/95 border-blue-500/30'
        }`}>
          <p className={`font-semibold mb-2 text-xs uppercase tracking-wider ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
          }`}>{data.date}</p>
          <p className={`text-2xl font-black mb-1 ${
            theme === 'light' ? 'text-slate-900' : 'text-white'
          }`}>₹{data.price.toFixed(2)}</p>
          {data.return !== undefined && (
            <p className={`text-sm font-bold flex items-center gap-1 ${
              data.return >= 0 ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {data.return >= 0
                ? <TrendingUp size={14} />
                : <TrendingDown size={14} />}
              {data.return >= 0 ? '+' : ''}{data.return.toFixed(2)}% daily
            </p>
          )}
          <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
            {data.isActual ? 'Current Price' : 'Predicted Price'}
          </p>
        </div>
      );
    }
    return null;
  };

  const exportToCSV = () => {
    if (!prediction) return;
    const csvData = [
      ['Stock Symbol', selectedStock.value],
      ['Current Price', prediction.current_price],
      ['Current Date', prediction.current_date],
      ['Prediction Days', daysAhead],
      [''],
      ['Date', 'Predicted Price', 'Daily Return (%)']
    ];
    prediction.predictions.forEach(p => {
      csvData.push([p.date, p.predicted_price.toFixed(2), p.predicted_return.toFixed(2)]);
    });
    const blob = new Blob([csvData.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedStock.value}_prediction_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToExcel = () => {
    if (!prediction) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
      ['Stock Symbol', selectedStock.value],
      ['Current Price', prediction.current_price],
      ['Current Date', prediction.current_date],
      ['Prediction Days', daysAhead],
      ['Expected Change (%)', totalChange],
      [''],
      ['Generated On', new Date().toLocaleString()]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
    const predictionsData = [['Date', 'Predicted Price', 'Daily Return (%)']];
    prediction.predictions.forEach(p => {
      predictionsData.push([p.date, p.predicted_price, p.predicted_return]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(predictionsData), 'Predictions');
    XLSX.writeFile(wb, `${selectedStock.value}_prediction_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Shared card wrapper style ──────────────────────────────────────────────
  const cardClass = `rounded-2xl border backdrop-blur-sm ${
    theme === 'light'
      ? 'bg-white/80 border-slate-200/80 shadow-sm'
      : 'bg-[#1e293b]/60 border-white/10'
  }`;

  const innerCardClass = `rounded-2xl border ${
    theme === 'light'
      ? 'bg-slate-50/80 border-slate-200/60'
      : 'bg-[#1e293b]/50 border-white/5'
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
            Stock Predictions
          </h1>
        </div>
        <p className={`ml-5 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
          Ensemble deep learning model combining LSTM, GRU and XGBoost
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">

        {/* Controls card */}
        <div className={`${cardClass} p-6`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">

            <div className="flex flex-col gap-2">
              <label className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                <Search size={12} /> Search Stock
              </label>
              <Select
                value={selectedStock}
                onChange={setSelectedStock}
                options={stocks}
                isDisabled={loading}
                isSearchable
                placeholder="Type to search..."
                styles={selectStyles}
                noOptionsMessage={() => 'No stocks found'}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={`text-xs font-bold uppercase tracking-widest ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Prediction Days
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={daysAhead}
                onChange={handleDaysChange}
                disabled={loading}
                className={`w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                  daysError
                    ? 'border-red-500 focus:border-red-500'
                    : theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 hover:border-slate-300'
                      : 'bg-[#1e293b] border-[#1e293b] text-slate-200 focus:border-blue-500 hover:border-[#334155]'
                }`}
              />
              {daysError && (
                <p className="text-red-500 text-xs font-semibold flex items-center gap-1">
                  ⚠ {daysError}
                </p>
              )}
            </div>

            <button
              onClick={fetchPrediction}
              disabled={loading || !selectedStock || !!daysError}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl font-bold transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Predicting...
                </>
              ) : (
                <>
                  <TrendingUp size={18} />
                  Predict
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-xl font-medium flex items-center gap-3">
            ⚠ {error}
          </div>
        )}

        {loading && <SkeletonLoader />}

        {!loading && prediction && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: DollarSign,
                  label: 'Current Price',
                  value: `₹${prediction.current_price.toFixed(2)}`,
                  accent: 'from-blue-500 to-blue-600',
                  iconBg: theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'
                },
                {
                  icon: Calendar,
                  label: `${daysAhead}-Day Forecast`,
                  value: `₹${lastPrediction?.predicted_price.toFixed(2)}`,
                  accent: 'from-cyan-500 to-cyan-600',
                  iconBg: theme === 'light' ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-500/10 text-cyan-400'
                },
                {
                  icon: totalChange >= 0 ? TrendingUp : TrendingDown,
                  label: 'Expected Change',
                  value: `${totalChange >= 0 ? '+' : ''}${totalChange}%`,
                  isChange: true,
                  accent: totalChange >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600',
                  iconBg: totalChange >= 0
                    ? (theme === 'light' ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400')
                    : (theme === 'light' ? 'bg-red-50 text-red-600' : 'bg-red-500/10 text-red-400')
                }
              ].map((stat, idx) => (
                <div key={idx} className={`${cardClass} p-6 flex items-center gap-5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.2)]`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${stat.iconBg}`}>
                    <stat.icon size={26} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                      theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                    }`}>{stat.label}</p>
                    <p className={`text-2xl font-black ${
                      stat.isChange
                        ? (totalChange >= 0 ? 'text-emerald-500' : 'text-red-500')
                        : (theme === 'light' ? 'text-slate-900' : 'text-white')
                    }`}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart card */}
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
                  <h2 className={`text-lg font-bold ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>Price Prediction Chart</h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {['line', 'area'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setChartType(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all capitalize ${
                        chartType === type
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]'
                          : theme === 'light'
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowBrush(!showBrush)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      showBrush
                        ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                        : theme === 'light'
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Maximize2 size={12} /> Zoom
                  </button>

                  <div className={`w-px h-5 mx-1 ${theme === 'light' ? 'bg-slate-200' : 'bg-white/10'}`} />

                  <button
                    onClick={exportToCSV}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      theme === 'light'
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    <Download size={12} /> CSV
                  </button>
                  <button
                    onClick={exportToExcel}
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
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} />
                    <XAxis dataKey="date" stroke={theme === 'light' ? '#64748b' : '#94a3b8'} style={{ fontSize: '11px' }} />
                    <YAxis domain={['auto', 'auto']} stroke={theme === 'light' ? '#64748b' : '#94a3b8'} style={{ fontSize: '11px' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="url(#lineGrad)"
                      strokeWidth={3}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        return (
                          <circle
                            key={`dot-${cx}-${cy}`}
                            cx={cx} cy={cy}
                            r={payload.isActual ? 7 : 4}
                            fill={payload.isActual ? '#10b981' : '#3b82f6'}
                            stroke={theme === 'light' ? '#fff' : '#1e293b'}
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 8 }}
                    />
                    {showBrush && (
                      <Brush dataKey="date" height={28} stroke="#3b82f6"
                        fill={theme === 'light' ? '#f8fafc' : '#0f172a'} />
                    )}
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                ) : (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.6} />
                        <stop offset="50%"  stopColor="#06b6d4" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'} />
                    <XAxis dataKey="date" stroke={theme === 'light' ? '#94a3b8' : '#334155'} style={{ fontSize: '11px' }} />
                    <YAxis domain={['auto', 'auto']} stroke={theme === 'light' ? '#94a3b8' : '#334155'} style={{ fontSize: '11px' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#areaGrad)"
                    />
                    {showBrush && (
                      <Brush dataKey="date" height={28} stroke="#3b82f6"
                        fill={theme === 'light' ? '#f8fafc' : '#0f172a'} />
                    )}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Table card */}
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
                <h3 className={`text-lg font-bold ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>Detailed Predictions</h3>
              </div>
              <div className="overflow-x-auto rounded-xl">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={
                      theme === 'light' ? 'bg-slate-100/80' : 'bg-white/5'
                    }>
                      {['Date', 'Predicted Price', 'Daily Return'].map(h => (
                        <th key={h} className={`text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest ${
                          theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.predictions.map((p, idx) => (
                      <tr key={idx} className={`border-b transition-colors ${
                        theme === 'light'
                          ? 'border-slate-100 hover:bg-blue-50/50'
                          : 'border-white/5 hover:bg-blue-500/5'
                      }`}>
                        <td className={`px-5 py-4 text-sm font-medium ${
                          theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                        }`}>{p.date}</td>
                        <td className={`px-5 py-4 text-sm font-bold ${
                          theme === 'light' ? 'text-slate-900' : 'text-white'
                        }`}>₹{p.predicted_price.toFixed(2)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-lg ${
                            p.predicted_return >= 0
                              ? theme === 'light'
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-emerald-500/10 text-emerald-400'
                              : theme === 'light'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-red-500/10 text-red-400'
                          }`}>
                            {p.predicted_return >= 0
                              ? <TrendingUp size={12} />
                              : <TrendingDown size={12} />}
                            {p.predicted_return >= 0 ? '+' : ''}{p.predicted_return.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}

export default Predictions;