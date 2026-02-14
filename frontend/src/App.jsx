import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Predictions from './pages/Predictions';
import Comparison from './pages/Comparison';
import Watchlist from './pages/Watchlist';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
        <Navbar />
        <Routes>
          <Route path="/" element={<Predictions />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
