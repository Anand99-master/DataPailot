import React from 'react';

export interface DataPilotLogoProps {
  variant?: 'icon' | 'full' | 'compact' | 'favicon';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
}

export const DataPilotLogo: React.FC<DataPilotLogoProps> = ({
  variant = 'full',
  className = '',
  size = 'md',
  showTagline = false
}) => {
  const sizeMap = {
    sm: { icon: 'w-5 h-5', text: 'text-xs', wrapper: 'space-x-1.5' },
    md: { icon: 'w-7 h-7', text: 'text-sm font-bold', wrapper: 'space-x-2' },
    lg: { icon: 'w-9 h-9', text: 'text-base font-bold', wrapper: 'space-x-2.5' },
    xl: { icon: 'w-12 h-12', text: 'text-xl font-extrabold', wrapper: 'space-x-3' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const renderIcon = (customClass = '') => (
    <div
      className={`relative rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 flex items-center justify-center text-white flex-shrink-0 shadow-sm ${
        customClass || currentSize.icon
      }`}
      role="img"
      aria-label="DataPilot Logo Mark"
    >
      {/* Concept 4: Minimal & Bold - Stylized D with integrated forward pilot arrow */}
      <svg
        className="w-3/5 h-3/5 text-white"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 4h7a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6H5V4z"
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M9 8l6 4-6 4V8z"
          fill="currentColor"
        />
      </svg>
    </div>
  );

  if (variant === 'icon' || variant === 'favicon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} aria-label="DataPilot Logo">
        {renderIcon()}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center ${currentSize.wrapper} ${className}`} aria-label="DataPilot">
        {renderIcon('w-6 h-6 rounded-lg')}
        <div className={`tracking-tight ${currentSize.text} flex items-center`}>
          <span className="font-extrabold text-slate-100 dark:text-white">Data</span>
          <span className="font-semibold text-cyan-400">Pilot</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${currentSize.wrapper} ${className}`} aria-label="DataPilot">
      {renderIcon()}
      <div className="flex flex-col">
        <div className="flex items-center space-x-1.5">
          <div className={`tracking-tight ${currentSize.text} flex items-center`}>
            <span className="font-extrabold text-slate-100 dark:text-white">Data</span>
            <span className="font-semibold text-cyan-400">Pilot</span>
          </div>
          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded">
            v1.0
          </span>
        </div>
        {showTagline && (
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">Data + Direction + Decisions</span>
        )}
      </div>
    </div>
  );
};
