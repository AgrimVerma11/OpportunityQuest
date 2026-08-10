import "./ProgressBar.css";

// A slim gold-gradient progress bar (profile-completion nudge, etc.).
// `value` is a 0–100 percentage; out-of-range values are clamped. `label`
// sets an accessible name. Namespaced (oq-).
export default function ProgressBar({ value = 0, label, className = "" }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={`oq-progress${className ? ` ${className}` : ""}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="oq-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
