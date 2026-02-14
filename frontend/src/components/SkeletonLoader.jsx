function SkeletonLoader() {
  return (
    <div className="animate-[fadeIn_0.3s_ease-in]">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            className="h-32 rounded-2xl bg-gradient-to-r from-dark-card/50 via-blue-500/10 to-dark-card/50 bg-[length:200%_100%] animate-shimmer"
          />
        ))}
      </div>
      
      {/* Chart Skeleton */}
      <div className="h-[450px] rounded-2xl bg-gradient-to-r from-dark-card/50 via-blue-500/10 to-dark-card/50 bg-[length:200%_100%] animate-shimmer mb-10" />
      
      {/* Table Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i}
            className="h-16 rounded-xl bg-gradient-to-r from-dark-card/50 via-blue-500/10 to-dark-card/50 bg-[length:200%_100%] animate-shimmer"
          />
        ))}
      </div>
    </div>
  );
}

export default SkeletonLoader;
