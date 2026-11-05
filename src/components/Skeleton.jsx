// Layout-shaped placeholder used while data is loading.
export default function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <span key={i} className="skeleton-line" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}
