import "./Spinner.css";

// Accessible loading indicator. Use inline (<Spinner />) or as a centered block
// that fills its container (<Spinner center label="Loading opportunities" />).
export default function Spinner({ size = "md", center = false, label = "Loading" }) {
  const ring = (
    <span
      className={`spinner spinner-${size}`}
      role="status"
      aria-live="polite"
    >
      <span className="visually-hidden">{label}…</span>
    </span>
  );

  if (!center) return ring;

  return (
    <div className="spinner-center">
      {ring}
      <span className="spinner-label">{label}…</span>
    </div>
  );
}
