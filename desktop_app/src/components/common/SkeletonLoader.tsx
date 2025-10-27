import React from 'react';

export interface SkeletonLoaderProps {
  type?: 'chat' | 'settings' | 'character' | 'workflow' | 'adapter' | 'editor' | 'customizer' | 'market' | 'model-viewer' | 'file-manager' | 'settings-panel' | 'monitor' | 'table' | 'chart' | 'calendar' | 'default';
  className?: string;
}

/**
 * 骨架屏加载组件
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  type = 'default',
  className = '' 
}) => {
  const baseClass = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  const renderSkeleton = () => {
    switch (type) {
      case 'chat':
        return (
          <div className={`space-y-4 p-4 ${className}`}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex space-x-3">
                <div className={`${baseClass} h-10 w-10 rounded-full`} />
                <div className="flex-1 space-y-2">
                  <div className={`${baseClass} h-4 w-3/4`} />
                  <div className={`${baseClass} h-4 w-1/2`} />
                </div>
              </div>
            ))}
          </div>
        );

      case 'settings':
        return (
          <div className={`p-6 space-y-6 ${className}`}>
            <div className={`${baseClass} h-8 w-48`} />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className={`${baseClass} h-4 w-32`} />
                  <div className={`${baseClass} h-10 w-full`} />
                </div>
              ))}
            </div>
          </div>
        );

      case 'character':
        return (
          <div className={`p-6 ${className}`}>
            <div className="flex space-x-6">
              <div className={`${baseClass} h-64 w-48`} />
              <div className="flex-1 space-y-4">
                <div className={`${baseClass} h-8 w-64`} />
                <div className={`${baseClass} h-4 w-full`} />
                <div className={`${baseClass} h-4 w-3/4`} />
                <div className="grid grid-cols-2 gap-4 mt-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`${baseClass} h-20`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'workflow':
        return (
          <div className={`p-6 space-y-4 ${className}`}>
            <div className="flex space-x-4">
              <div className={`${baseClass} h-10 w-32`} />
              <div className={`${baseClass} h-10 w-32`} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={`${baseClass} h-32`} />
              ))}
            </div>
          </div>
        );

      case 'adapter':
        return (
          <div className={`p-6 space-y-4 ${className}`}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className={`${baseClass} h-16 w-16 rounded-lg`} />
                <div className="flex-1 space-y-2">
                  <div className={`${baseClass} h-5 w-48`} />
                  <div className={`${baseClass} h-4 w-full`} />
                </div>
                <div className={`${baseClass} h-10 w-24`} />
              </div>
            ))}
          </div>
        );

      case 'editor':
        return (
          <div className={`p-6 space-y-4 ${className}`}>
            <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 pb-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${baseClass} h-8 w-24`} />
              ))}
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className={`${baseClass} h-4 w-full`} style={{ width: `${Math.random() * 40 + 60}%` }} />
              ))}
            </div>
          </div>
        );

      case 'customizer':
        return (
          <div className={`p-6 ${className}`}>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className={`${baseClass} h-4 w-24`} />
                    <div className={`${baseClass} h-10 w-full`} />
                  </div>
                ))}
              </div>
              <div className={`${baseClass} h-96`} />
            </div>
          </div>
        );

      case 'market':
        return (
          <div className={`p-6 ${className}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                  <div className={`${baseClass} h-40 w-full rounded-lg`} />
                  <div className={`${baseClass} h-5 w-3/4`} />
                  <div className={`${baseClass} h-4 w-full`} />
                  <div className="flex justify-between items-center">
                    <div className={`${baseClass} h-4 w-20`} />
                    <div className={`${baseClass} h-8 w-24`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'model-viewer':
        return (
          <div className={`flex items-center justify-center h-full ${className}`}>
            <div className="text-center space-y-4">
              <div className={`${baseClass} h-64 w-64 mx-auto rounded-lg`} />
              <div className={`${baseClass} h-4 w-48 mx-auto`} />
            </div>
          </div>
        );

      case 'file-manager':
        return (
          <div className={`p-6 ${className}`}>
            <div className="flex space-x-4 mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${baseClass} h-8 w-24`} />
              ))}
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className={`${baseClass} h-8 w-8`} />
                  <div className={`${baseClass} h-4 flex-1`} />
                  <div className={`${baseClass} h-4 w-20`} />
                </div>
              ))}
            </div>
          </div>
        );

      case 'settings-panel':
        return (
          <div className={`p-6 space-y-4 ${className}`}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className={`${baseClass} h-5 w-32`} />
                <div className={`${baseClass} h-12 w-full`} />
              </div>
            ))}
          </div>
        );

      case 'monitor':
        return (
          <div className={`p-6 space-y-6 ${className}`}>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${baseClass} h-24 rounded-lg`} />
              ))}
            </div>
            <div className={`${baseClass} h-64 rounded-lg`} />
          </div>
        );

      case 'table':
        return (
          <div className={`p-6 ${className}`}>
            <div className={`${baseClass} h-10 w-full mb-4`} />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex space-x-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className={`${baseClass} h-8 flex-1`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );

      case 'chart':
        return (
          <div className={`p-6 ${className}`}>
            <div className={`${baseClass} h-8 w-48 mb-4`} />
            <div className={`${baseClass} h-64 w-full rounded-lg`} />
          </div>
        );

      case 'calendar':
        return (
          <div className={`p-6 ${className}`}>
            <div className="flex justify-between mb-4">
              <div className={`${baseClass} h-8 w-32`} />
              <div className="flex space-x-2">
                <div className={`${baseClass} h-8 w-8`} />
                <div className={`${baseClass} h-8 w-8`} />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className={`${baseClass} h-12`} />
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className={`p-4 space-y-3 ${className}`}>
            <div className={`${baseClass} h-6 w-3/4`} />
            <div className={`${baseClass} h-4 w-full`} />
            <div className={`${baseClass} h-4 w-5/6`} />
          </div>
        );
    }
  };

  return (
    <div className="skeleton-loader" role="status" aria-label="加载中">
      {renderSkeleton()}
    </div>
  );
};

export default SkeletonLoader;

