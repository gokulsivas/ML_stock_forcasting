import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, UserPlus, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="mt-2 flex gap-3 flex-wrap">
      {checks.map(c => (
        <span key={c.label} className={`flex items-center gap-1 text-xs ${c.ok ? 'text-green-400' : 'text-slate-500'}`}>
          <CheckCircle size={11} className={c.ok ? 'text-green-400' : 'text-slate-600'} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

export default function SignUp({ onNavigate }) {
  const { signup }                    = useAuth();
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password || !confirm) { setError('Please fill in all fields'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      await signup(username, email, password);
      onNavigate('dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-cyan-600/10 blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl"/>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <button onClick={() => onNavigate('landing')} className="inline-flex items-center gap-2 mb-6">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#1e3a5f"/>
              <polyline points="4,26 10,18 16,22 22,10 28,16 32,8"
                stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="32" cy="8" r="3" fill="#34d399"/>
            </svg>
            <span className="font-black text-xl text-white">NSE<span className="text-blue-400">Predict</span></span>
          </button>
          <h1 className="text-3xl font-black text-white mb-2">Create your account</h1>
          <p className="text-slate-400">Join thousands of NSE investors</p>
        </div>

        <div className="bg-[#111827]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm">
              <AlertCircle size={16} className="shrink-0"/>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full px-4 py-3 bg-[#0f172a] border-2 border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none rounded-xl text-slate-200 placeholder-slate-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-[#0f172a] border-2 border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none rounded-xl text-slate-200 placeholder-slate-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-4 py-3 pr-11 bg-[#0f172a] border-2 border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none rounded-xl text-slate-200 placeholder-slate-500 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                  {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
              <PasswordStrength password={password}/>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className={`w-full px-4 py-3 bg-[#0f172a] border-2 rounded-xl text-slate-200 placeholder-slate-500 transition-colors focus:outline-none ${
                  confirm && confirm !== password ? 'border-red-500' : 'border-slate-700 hover:border-slate-600 focus:border-blue-500'
                }`}
              />
              {confirm && confirm !== password && (
                <p className="text-red-400 text-xs mt-1">Passwords don't match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Creating account…</>
              ) : (
                <><UserPlus size={18}/> Create Account</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-slate-400 text-sm">
            Already have an account?{' '}
            <button onClick={() => onNavigate('signin')} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
