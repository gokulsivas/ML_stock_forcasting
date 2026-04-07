import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Predictions from './pages/Predictions';
import Comparison from './pages/Comparison';
import Watchlist from './pages/Watchlist';
import LandingPage from './pages/LandingPage';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import { useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';   // ← NEW


// ── Protects routes that require login ────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    // Still restoring session from sessionStorage — show nothing briefly
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in → redirect to sign in
  return user ? children : <Navigate to="/signin" replace />;
}


function AppRoutes() {
  const { theme } = useTheme();
  const { user } = useAuth();

  return (
    <div className={`min-h-screen ${
      theme === 'light' ? 'bg-[#f8fafc]' : 'bg-[#0f172a]'
    } transition-colors duration-300`}>
      <Routes>

        {/* ── Public routes (no Navbar) ─────────────────────────────────── */}
        <Route
          path="/"
          element={user ? <Navigate to="/predictions" replace /> : <LandingPage />}
        />
        <Route
          path="/signin"
          element={user ? <Navigate to="/predictions" replace /> : <SignIn />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to="/predictions" replace /> : <SignUp />}
        />

        {/* ── Protected routes (with Navbar) ───────────────────────────── */}
        <Route
          path="/predictions"
          element={
            <ProtectedRoute>
              <Navbar />
              <Predictions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comparison"
          element={
            <ProtectedRoute>
              <Navbar />
              <Comparison />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watchlist"
          element={
            <ProtectedRoute>
              <Navbar />
              <Watchlist />
            </ProtectedRoute>
          }
        />

        {/* ── Fallback ─────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </div>
  );
}


function App() {
  return (
    <AuthProvider>        {/* ← wraps everything so useAuth() works anywhere */}
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}


export default App;