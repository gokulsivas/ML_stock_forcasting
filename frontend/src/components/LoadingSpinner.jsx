import { useTheme } from '../context/ThemeContext';

function LoadingSpinner({ size = 'medium' }) {
  const { theme } = useTheme();
  
  const sizeClasses = {
    small: 'w-6 h-6 border-2',
    medium: 'w-12 h-12 border-3',
    large: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} ${
        theme === 'light' 
          ? 'border-slate-200 border-t-blue-500' 
          : 'border-slate-700 border-t-blue-500'
      } rounded-full animate-spin`}></div>
    </div>
  );
}

export default LoadingSpinner;
