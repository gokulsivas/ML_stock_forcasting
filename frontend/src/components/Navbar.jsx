import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, BarChart3, Star, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function Navbar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  const isActive = (path) => location.pathname === path;
  
  const linkClass = (path) => `
    flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300
    ${isActive(path) 
      ? 'bg-gradient-to-r from-indigo-700 to-indigo-600 text-white shadow-[0_8px_30px_-5px_rgba(59,130,246,0.5)]' 
      : theme === 'light'
        ? 'text-slate-700 hover:bg-slate-100'
        : 'text-slate-300 hover:bg-slate-800'
    }
  `;

  return (
    <nav className={`${
      theme === 'light' 
        ? 'bg-white border-slate-200' 
        : 'bg-dark-card/80 border-white/10'
    } backdrop-blur-xl border-b sticky top-0 z-50 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className={`w-12 h-12 rounded-xl ${
              theme === 'light' 
                ? 'bg-gradient-to-br from-indigo-600 to-indigo-600' 
                : 'bg-gradient-to-br from-indigo-700 to-indigo-600'
            } flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg`}>
              <TrendingUp className="text-white" size={24} />
            </div>
            <span className={`text-2xl font-bold ${
              theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
            } tracking-tight`}>
              StockPredict
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-3">
            <Link to="/predictions" className={linkClass('/predictions')}>
              <TrendingUp size={20} />
              Predictions
            </Link>
            
            <Link to="/comparison" className={linkClass('/comparison')}>
              <BarChart3 size={20} />
              Comparison
            </Link>
            
            <Link to="/watchlist" className={linkClass('/watchlist')}>
              <Star size={20} />
              Watchlist
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`ml-4 p-3 rounded-xl transition-all duration-300 ${
                theme === 'light'
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
