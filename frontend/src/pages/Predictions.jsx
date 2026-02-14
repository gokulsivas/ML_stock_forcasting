import { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, Area, AreaChart } from 'recharts';
import { Calendar, DollarSign, Activity, Search, Maximize2, Download, FileSpreadsheet } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import SkeletonLoader from '../components/SkeletonLoader';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

function Predictions() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [daysAhead, setDaysAhead] = useState(5);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState('line');
  const [showBrush, setShowBrush] = useState(false);

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
      if (stockOptions.length > 0) {
        setSelectedStock(stockOptions[0]);
      }
    } catch (err) {
      setError('Failed to fetch stocks');
    } finally {
      setLoadingStocks(false);
    }
  };

  const fetchPrediction = async () => {
    if (!selectedStock) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/predict/`, {
        symbol: selectedStock.value,
        days_ahead: daysAhead
      });
      setPrediction(response.data);
      if (daysAhead > 30) {
        setShowBrush(true);
      }
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
      background: '#1e293b',
      borderColor: state.isFocused ? '#3b82f6' : '#334155',
      borderWidth: '2px',
      borderRadius: '12px',
      padding: '0.375rem 0.5rem',
      boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
      '&:hover': {
        borderColor: '#475569'
      },
      cursor: 'text'
    }),
    menu: (base) => ({
      ...base,
      background: '#1e293b',
      border: '2px solid #334155',
      borderRadius: '12px',
      marginTop: '8px',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
    }),
    menuList: (base) => ({
      ...base,
      padding: '8px',
      maxHeight: '300px',
      '::-webkit-scrollbar': {
        width: '8px'
      },
      '::-webkit-scrollbar-track': {
        background: '#0f172a',
        borderRadius: '4px'
      },
      '::-webkit-scrollbar-thumb': {
        background: '#475569',
        borderRadius: '4px'
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: '#64748b'
      }
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? '#3b82f6' : 'transparent',
      color: '#e2e8f0',
      padding: '12px 16px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: state.isSelected ? '600' : '500',
      '&:active': {
        background: '#2563eb'
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: '#e2e8f0',
      fontWeight: '500'
    }),
    input: (base) => ({
      ...base,
      color: '#e2e8f0'
    }),
    placeholder: (base) => ({
      ...base,
      color: '#64748b'
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: '#64748b',
      '&:hover': {
        color: '#94a3b8'
      }
    }),
    indicatorSeparator: () => ({
      display: 'none'
    })
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1e293b] border-2 border-blue-500/30 rounded-xl p-4 shadow-2xl">
          <p className="text-slate-300 font-semibold mb-2">{data.date}</p>
          <p className="text-slate-200 text-lg font-bold">
            ₹{data.price.toFixed(2)}
          </p>
          {data.return !== undefined && (
            <p className={`text-sm font-semibold mt-1 ${data.return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.return >= 0 ? '+' : ''}{data.return.toFixed(2)}% daily return
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">
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

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

    const predictionsData = [
      ['Date', 'Predicted Price', 'Daily Return (%)']
    ];

    prediction.predictions.forEach(p => {
      predictionsData.push([p.date, p.predicted_price, p.predicted_return]);
    });

    const predictionsWS = XLSX.utils.aoa_to_sheet(predictionsData);
    XLSX.utils.book_append_sheet(wb, predictionsWS, 'Predictions');

    XLSX.writeFile(wb, `${selectedStock.value}_prediction_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-200 mb-2">Stock Price Predictions</h1>
        <p className="text-slate-400">AI-powered predictions using Hybrid LSTM-GRU deep learning model</p>
      </div>

      <div className="w-full bg-dark-card/50 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Search size={14} />
              Search Stock
            </label>
            <Select
              value={selectedStock}
              onChange={setSelectedStock}
              options={stocks}
              isDisabled={loading}
              isSearchable={true}
              placeholder="Type to search stocks..."
              styles={selectStyles}
              noOptionsMessage={() => "No stocks found"}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Prediction Days
            </label>
            <input 
              type="number" 
              min="1" 
              max="365" 
              value={daysAhead}
              onChange={(e) => setDaysAhead(parseInt(e.target.value))}
              disabled={loading}
              className="w-full px-4 py-3.5 bg-dark-card border-2 border-dark-border rounded-xl text-slate-200 font-medium transition-all duration-300 focus:outline-none focus:border-blue-500 focus:bg-[#0f172a] focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] hover:border-dark-hover disabled:opacity-50"
            />
          </div>

          <button 
            onClick={fetchPrediction} 
            disabled={loading || !selectedStock}
            className="flex items-center justify-center gap-2 px-10 py-3.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold uppercase tracking-wide transition-all duration-300 hover:shadow-[0_15px_35px_-5px_rgba(59,130,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Predicting...
              </>
            ) : 'Predict'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-5 py-4 rounded-xl mb-6 font-medium">
            {error}
          </div>
        )}

        {loading && <SkeletonLoader />}

        {!loading && prediction && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 p-7 rounded-2xl flex items-center gap-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] hover:border-blue-500/40 backdrop-blur-sm">
                <div className="w-16 h-16 flex items-center justify-center bg-blue-500/10 rounded-xl text-blue-500">
                  <DollarSign size={32} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Current Price</div>
                  <div className="text-3xl font-bold text-slate-200">₹{prediction.current_price.toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 p-7 rounded-2xl flex items-center gap-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] hover:border-blue-500/40 backdrop-blur-sm">
                <div className="w-16 h-16 flex items-center justify-center bg-blue-500/10 rounded-xl text-blue-500">
                  <Calendar size={32} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">
                    Predicted Price ({daysAhead}d)
                  </div>
                  <div className="text-3xl font-bold text-slate-200">₹{lastPrediction?.predicted_price.toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 p-7 rounded-2xl flex items-center gap-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] hover:border-blue-500/40 backdrop-blur-sm">
                <div className="w-16 h-16 flex items-center justify-center bg-blue-500/10 rounded-xl text-blue-500">
                  <Activity size={32} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Expected Change</div>
                  <div className={`text-3xl font-bold ${totalChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalChange >= 0 ? '+' : ''}{totalChange}%
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0f172a]/50 rounded-2xl p-8 border border-white/5 mb-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-200">Price Prediction Chart</h2>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setChartType('line')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      chartType === 'line'
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                    }`}
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartType('area')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      chartType === 'area'
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                    }`}
                  >
                    Area
                  </button>
                  <button
                    onClick={() => setShowBrush(!showBrush)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                      showBrush
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                    }`}
                    title="Toggle zoom slider"
                  >
                    <Maximize2 size={16} />
                    Zoom
                  </button>

                  <div className="w-px bg-slate-600 mx-2"></div>

                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 rounded-lg font-semibold transition-all bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center gap-2"
                    title="Export to CSV"
                  >
                    <Download size={16} />
                    CSV
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="px-4 py-2 rounded-lg font-semibold transition-all bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center gap-2"
                    title="Export to Excel"
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={500}>
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={payload.isActual ? 8 : 5}
                            fill={payload.isActual ? '#10b981' : '#3b82f6'}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 8 }}
                    />
                    {showBrush && (
                      <Brush 
                        dataKey="date" 
                        height={30} 
                        stroke="#3b82f6"
                        fill="#1e293b"
                      />
                    )}
                  </LineChart>
                ) : (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPriceArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorPriceArea)"
                    />
                    {showBrush && (
                      <Brush 
                        dataKey="date" 
                        height={30} 
                        stroke="#3b82f6"
                        fill="#1e293b"
                      />
                    )}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="bg-[#0f172a]/50 rounded-2xl p-8 border border-white/5">
              <h3 className="text-xl font-bold text-slate-200 mb-6">Detailed Predictions</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-500/5">
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Date</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Predicted Price</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Daily Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.predictions.map((p, idx) => (
                      <tr key={idx} className="border-b border-white/5 transition-colors hover:bg-blue-500/5">
                        <td className="px-5 py-4 text-slate-200 font-medium">{p.date}</td>
                        <td className="px-5 py-4 text-slate-200 font-medium">₹{p.predicted_price.toFixed(2)}</td>
                        <td className={`px-5 py-4 font-bold ${p.predicted_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.predicted_return >= 0 ? '+' : ''}{p.predicted_return.toFixed(2)}%
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
