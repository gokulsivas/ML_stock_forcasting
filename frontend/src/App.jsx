import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Predictions from './pages/Predictions';
import Comparison from './pages/Comparison';
import Watchlist from './pages/Watchlist';
import { useTheme } from './context/ThemeContext';

function App() {
  const { theme } = useTheme();

  return (
    <Router>
      <div className={`min-h-screen ${
        theme === 'light' ? 'bg-[#f8fafc]' : 'bg-[#0f172a]'
      } transition-colors duration-300`}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/predictions" replace />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
