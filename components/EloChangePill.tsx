import React from 'react';

const EloChangePill: React.FC<{ change: number; className?: string }> = ({ change, className }) => {
  const up = change >= 0;
  const color = up
    ? 'text-green-300 border-green-400/40 bg-green-500/10'
    : 'text-red-300 border-red-400/40 bg-red-500/10';
  return (
    <span className={`inline-flex items-center justify-center gap-1 h-6 px-2 rounded-full text-xs font-semibold border leading-none align-middle whitespace-nowrap ${color} ${className ?? ''}`}>
      <svg className="block shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {up ? <path d="M12 5l-7 7h14z" /> : <path d="M12 19l7-7H5z" />}
      </svg>
      <span className="block font-mono">{Math.abs(change)}</span>
    </span>
  );
};

export default EloChangePill;
