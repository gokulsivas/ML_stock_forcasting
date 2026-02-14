import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, BarChart3, History, Star } from 'lucide-react';

function Navbar() {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <nav className="sticky top-0 z-50 bg-dark-card/80 backdrop-blur-xl border-b border-white/10 px-8 py-4 animate-[slideDown_0.4s_ease-out]">
      <div className="max-w-full mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          <TrendingUp size={28} className="text-blue-500" />
          <span>NSE Stock Predictor</span>
        </div>
        
        <div className="flex gap-4">
          <Link 
            to="/" 
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 border-2 ${
              isActive('/') 
                ? 'text-blue-500 bg-blue-500/15 border-blue-500/30' 
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-blue-500/10 hover:border-blue-500/20'
            }`}
          >
            <BarChart3 size={20} />
            <span>Predictions</span>
          </Link>
          
          <Link 
            to="/comparison" 
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 border-2 ${
              isActive('/comparison') 
                ? 'text-blue-500 bg-blue-500/15 border-blue-500/30' 
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-blue-500/10 hover:border-blue-500/20'
            }`}
          >
            <History size={20} />
            <span>Compare</span>
          </Link>
          
          <Link 
            to="/watchlist" 
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 border-2 ${
              isActive('/watchlist') 
                ? 'text-blue-500 bg-blue-500/15 border-blue-500/30' 
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-blue-500/10 hover:border-blue-500/20'
            }`}
          >
            <Star size={20} />
            <span>Watchlist</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
