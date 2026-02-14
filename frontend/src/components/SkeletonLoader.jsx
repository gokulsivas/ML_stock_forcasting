import { useTheme } from '../context/ThemeContext';

function SkeletonLoader() {
  const { theme } = useTheme();
  
  const bgClass = theme === 'light' 
    ? 'bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100' 
    : 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800';

  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${bgClass} h-32 rounded-2xl animate-[shimmer_2s_infinite_linear]`}
            style={{ backgroundSize: '1000px 100%' }}></div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className={`${bgClass} h-96 rounded-2xl animate-[shimmer_2s_infinite_linear]`}
        style={{ backgroundSize: '1000px 100%' }}></div>

      {/* Table Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`${bgClass} h-16 rounded-xl animate-[shimmer_2s_infinite_linear]`}
            style={{ backgroundSize: '1000px 100%' }}></div>
        ))}
      </div>
    </div>
  );
}

export default SkeletonLoader;
