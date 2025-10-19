import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '加载中...',
  size = 'medium',
  className = ''
}) => {
  return (
    <div className={`loading-spinner ${size} ${className}`}>
      <div className="spinner-circle">
        <div className="spinner-inner"></div>
      </div>
      {message && (
        <div className="spinner-message">
          {message}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
