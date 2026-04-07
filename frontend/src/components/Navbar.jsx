import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3, Star, Sun, Moon, LogOut, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout }       = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) => `
    flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 text-sm
    ${isActive(path)
      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_4px_15px_-3px_rgba(59,130,246,0.5)]'
      : theme === 'light'
        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
    }
  `;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <nav className={`${
      theme === 'light'
        ? 'bg-white/90 border-slate-200/80'
        : 'bg-[#1e293b]/90 border-white/10'
    } backdrop-blur-xl border-b sticky top-0 z-50 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center py-3">

          {/* Logo — flex-1 keeps it in the left third */}
          <div className="flex-1">
            <Link to="/predictions" className="flex items-center gap-3 group w-fit">
              <div className="relative">
                <svg width="38" height="38" viewBox="0 0 36 36" fill="none">
                  <rect width="36" height="36" rx="10" fill="#1e3a5f"/>
                  <polyline points="4,26 10,18 16,22 22,10 28,16 32,8"
                    stroke="#60a5fa" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <circle cx="32" cy="8" r="3" fill="#34d399"/>
                </svg>
              </div>
              <span className={`text-xl font-black tracking-tight ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                Stock<span className="text-blue-400">Cast</span>
              </span>
            </Link>
          </div>

          {/* Nav Links — perfectly centered */}
          <div className="flex items-center gap-1">
            <Link to="/predictions" className={linkClass('/predictions')}>
              <TrendingUp size={17} />
              Predictions
            </Link>
            <Link to="/comparison" className={linkClass('/comparison')}>
              <BarChart3 size={17} />
              Comparison
            </Link>
            <Link to="/watchlist" className={linkClass('/watchlist')}>
              <Star size={17} />
              Watchlist
            </Link>
          </div>

          {/* Right side — flex-1 + justify-end pins it to the right third */}
          <div className="flex-1 flex items-center justify-end gap-3">

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl transition-all duration-300 ${
                theme === 'light'
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl transition-all duration-300 border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-black shadow-md">
                  {getInitials(user?.username)}
                </div>
                <span className={`text-sm font-semibold max-w-[100px] truncate ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {user?.username || 'Account'}
                </span>
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className={`absolute right-0 mt-2 w-56 rounded-2xl border shadow-2xl overflow-hidden z-50 ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 shadow-slate-200/60'
                    : 'bg-[#111827] border-white/10 shadow-black/40'
                }`}>
                  {/* User info header */}
                  <div className={`px-4 py-4 border-b ${
                    theme === 'light' ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-white/5'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-black shadow-md">
                        {getInitials(user?.username)}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold text-sm truncate ${
                          theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                        }`}>
                          {user?.username}
                        </p>
                        <p className={`text-xs truncate ${
                          theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sign out button */}
                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        theme === 'light'
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-red-400 hover:bg-red-500/10'
                      }`}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;