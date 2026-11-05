// Shared loading state. Uses the design-system tokens so every screen
// (auth, protected routes, data fetches) looks consistent.
export default function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <span className="loading-spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  );
}
