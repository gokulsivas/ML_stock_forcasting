import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on page load (sessionStorage survives refresh, clears on tab close)
  useEffect(() => {
    const savedToken = sessionStorage.getItem('auth_token');
    const savedUser  = sessionStorage.getItem('auth_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const _saveSession = (access_token, userData) => {
    setToken(access_token);
    setUser(userData);
    sessionStorage.setItem('auth_token', access_token);
    sessionStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const login = async (email, password) => {
    const { data } = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    _saveSession(data.access_token, data.user);
    return data.user;
  };

  const signup = async (username, email, password) => {
    const { data } = await axios.post(`${API_URL}/api/auth/signup`, { username, email, password });
    _saveSession(data.access_token, data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
  };

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, authHeaders, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
