import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '8px',
  className = '',
  style = {},
}) => {
  return (
    <span
      className={`skeleton-box ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        ...style,
      }}
    />
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => {
  return (
    <div className={`skeleton-text-group ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height="0.875rem" />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="skeleton-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="40%" height="1.25rem" />
        <Skeleton width="20%" height="1rem" borderRadius="20px" />
      </div>
      <SkeletonText lines={rows} />
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem', padding: '0.875rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px' }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} width={`${100 / columns}%`} height="1rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} width={`${100 / columns}%`} height="0.875rem" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: '1rem', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ padding: '1.25rem' }}>
          <Skeleton width="50%" height="0.875rem" />
          <Skeleton width="70%" height="1.75rem" style={{ marginTop: '0.5rem' }} />
        </div>
      ))}
    </div>
  );
};

export const SkeletonChart: React.FC<{ height?: number }> = ({ height = 280 }) => {
  return (
    <div className="skeleton-card" style={{ height: `${height}px`, justifyContent: 'flex-end', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '80%', width: '100%' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            width="100%"
            height={`${Math.floor(Math.random() * 60) + 20}%`}
            borderRadius="6px 6px 0 0"
          />
        ))}
      </div>
    </div>
  );
};
