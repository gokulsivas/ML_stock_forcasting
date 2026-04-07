import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart2, Star, Shield, Zap, Globe, ArrowRight, ChevronDown } from 'lucide-react';

function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let   animId;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const lines = Array.from({ length: 6 }, (_, i) => {
      const pts = [];
      let y = 0.2 + 0.12 * i;
      for (let x = 0; x <= 1.2; x += 0.015) {
        y += (Math.random() - 0.48) * 0.018;
        y = Math.max(0.02, Math.min(0.98, y));
        pts.push({ xr: x, yr: y });
      }
      return { pts, offset: 0, speed: 0.0004 + i * 0.0001, alpha: 0.06 + i * 0.01 };
    });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      lines.forEach(line => {
        line.offset = (line.offset + line.speed) % 0.2;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(99,179,237,${line.alpha})`;
        ctx.lineWidth = 1.5;
        line.pts.forEach((p, i) => {
          const cx = ((p.xr - line.offset + 1.2) % 1.2) * canvas.width;
          const cy = p.yr * canvas.height;
          i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
        });
        ctx.stroke();
      });

      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width)  p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height)  p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147,197,253,${p.alpha})`;
        ctx.fill();
      });

      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(147,197,253,${0.05 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        });
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

function FeatureCard({ icon: Icon, title, desc, gradient }) {
  return (
    <div className="relative rounded-2xl p-7 border border-white/10 backdrop-blur-sm overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.25)]">
      <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${gradient}`} />
      <div className="relative z-10">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
          <Icon size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-1">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const navigate  = useNavigate();
  const scrollRef = useRef(null);

  const scrollToFeatures = () =>
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Predictions',
      desc: 'Ensemble deep learning model combining LSTM, GRU, and advanced architectures trained on 4.2M+ NSE price records.',
      gradient: 'bg-gradient-to-br from-blue-600 to-purple-600',
    },
    {
      icon: BarChart2,
      title: 'Multi-Stock Comparison',
      desc: 'Compare predictions and performance across multiple NIFTY stocks simultaneously on a unified chart.',
      gradient: 'bg-gradient-to-br from-cyan-600 to-blue-600',
    },
    {
      icon: Star,
      title: 'Personal Watchlist',
      desc: 'Your watchlist is saved to your account, accessible from any device after you log in.',
      gradient: 'bg-gradient-to-br from-yellow-600 to-orange-600',
    },
    {
      icon: Globe,
      title: '400+ NSE Stocks',
      desc: 'Coverage across NIFTY 50, NIFTY Next 50, and NIFTY Midcap 150, the full NIFTY 250 universe.',
      gradient: 'bg-gradient-to-br from-green-600 to-teal-600',
    },
    {
      icon: Shield,
      title: 'Secure Auth',
      desc: 'JWT-based authentication with bcrypt password hashing. Your data and watchlist stay private.',
      gradient: 'bg-gradient-to-br from-purple-600 to-pink-600',
    },
    {
      icon: TrendingUp,
      title: 'Smart Recommendations',
      desc: 'Buy / Hold / Sell signals derived from model predictions, colour-coded for instant decision support.',
      gradient: 'bg-gradient-to-br from-rose-600 to-red-600',
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#0a0f1e] text-slate-200 overflow-x-hidden">
      <AnimatedBackground />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#1e3a5f"/>
            <polyline points="4,26 10,18 16,22 22,10 28,16 32,8"
              stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="32" cy="8" r="3" fill="#34d399"/>
          </svg>
          <span className="font-black text-xl text-white tracking-tight">
            Stock<span className="text-blue-400">Cast</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/signin')}
            className="px-5 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-16 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-8 tracking-wider uppercase">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Ensemble Deep Learning · 400+ NSE Stocks · 79.1% Directional Accuracy
        </div>

        <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
          <span className="text-white">Predict the</span>{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400">
            NSE Market
          </span>
          <br />
          <span className="text-white">with Deep Learning</span>
        </h1>

        <p className="text-lg md:text-1xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          AI-powered stock price forecasts for NIFTY stocks, up to 365 days ahead.
          Personal watchlists, multi-stock comparison, and smart Buy/Sell signals.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <button
            onClick={() => navigate('/signup')}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl text-base transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:-translate-y-0.5"
          >
            Create Free Account <ArrowRight size={18} />
          </button>
          <button
            onClick={() => navigate('/signin')}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white font-bold rounded-xl text-base transition-all duration-300"
          >
            Sign In
          </button>
        </div>

        {/* Stats row */}
        <div className="w-full max-w-2xl grid grid-cols-3 gap-6 py-6 border-t border-b border-white/10">
          <Stat value="4.2M+" label="NSE price records" />
          <Stat value="400+"  label="NIFTY stocks" />
          <Stat value="365d"  label="Max forecast horizon" />
        </div>

        <button
          onClick={scrollToFeatures}
          className="mt-10 flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className="text-xs tracking-widest uppercase">Explore</span>
          <ChevronDown size={20} className="animate-bounce" />
        </button>
      </section>

      {/* Dashboard preview mockup */}
      <section className="relative z-10 px-6 mb-24 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2 px-5 py-3 bg-white/5 border-b border-white/10">
            <span className="w-3 h-3 rounded-full bg-red-500/60"/>
            <span className="w-3 h-3 rounded-full bg-yellow-500/60"/>
            <span className="w-3 h-3 rounded-full bg-green-500/60"/>
            <span className="ml-4 text-xs text-slate-500 font-mono">StockCast Dashboard</span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                ['₹2,847.50', 'Current Price',  'text-slate-200'],
                ['₹3,120.80', '30-Day Forecast', 'text-slate-200'],
                ['▲ +9.60%',  'Expected Change', 'text-green-400'],
              ].map(([v, l, c]) => (
                <div key={l} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-1">{l}</div>
                  <div className={`text-xl font-bold ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="bg-black/30 rounded-xl p-4 h-36 flex items-end gap-1 overflow-hidden">
              {Array.from({ length: 40 }, (_, i) => {
                const h    = 30 + Math.sin(i * 0.3) * 20 + Math.random() * 25;
                const isUp = Math.random() > 0.4;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${isUp ? 'bg-blue-500/60' : 'bg-slate-600/60'}`}
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section ref={scrollRef} className="relative z-10 px-6 pb-24 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Everything you need to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              trade smarter
            </span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            A full-stack ML platform built for NSE investors, combining deep learning forecasts with clean, responsive UX.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* CTA strip */}
      <section className="relative z-10 px-6 pb-24 max-w-3xl mx-auto text-center">
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-900/40 to-cyan-900/20 backdrop-blur-sm p-12">
          <h2 className="text-3xl font-black text-white mb-4">Ready to start predicting?</h2>
          <p className="text-slate-400 mb-8">Create your free account in seconds. No credit card required.</p>
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl text-base transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:-translate-y-0.5"
          >
            Get Started, It's Free <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-slate-500 text-sm">
        StockCast · Ensemble Deep Learning Model · Built with FastAPI + React + PostgreSQL
      </footer>
    </div>
  );
}