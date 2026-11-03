export function Loader({ label }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label && <span className="loader-label">{label}</span>}
    </div>
  );
}
