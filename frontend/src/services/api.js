import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const stockAPI = {
  getAllStocks:     ()                      => api.get('/api/stocks'),
  getHistoricalData: (symbol, limit = 365) => api.get(`/api/stocks/${symbol}/historical`, { params: { limit } }),
  getLatestPrice:  (symbol)                => api.get(`/api/stocks/${symbol}/latest`),
  predictPrice:    (symbol, daysAhead, headers = {}) =>
    api.post('/api/predict', { symbol, daysahead: daysAhead }, { headers }),
  checkHealth:     ()                      => api.get('/api/predict/health'),
};

export const authAPI = {
  signup: (username, email, password) =>
    api.post('/api/auth/signup', { username, email, password }),
  login:  (email, password) =>
    api.post('/api/auth/login', { email, password }),
  getMe:  (token) =>
    api.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
};

export const watchlistAPI = {
  getWatchlist:        (headers) => api.get('/api/watchlist/',          { headers }),
  addToWatchlist:      (symbol, headers) => api.post(`/api/watchlist/${symbol}`, {}, { headers }),
  removeFromWatchlist: (symbol, headers) => api.delete(`/api/watchlist/${symbol}`,   { headers }),
  clearWatchlist:      (headers) => api.delete('/api/watchlist/',        { headers }),
};

export default api;
