function LoadingSpinner({ size = 'medium' }) {
  const sizeClasses = {
    small: 'w-8 h-8 border-2',
    medium: 'w-12 h-12 border-4',
    large: 'w-16 h-16 border-4'
  };
  
  return (
    <div className="flex justify-center items-center p-8">
      <div className={`${sizeClasses[size]} border-blue-500/20 border-t-blue-500 rounded-full animate-spin`}></div>
    </div>
  );
}

export default LoadingSpinner;
