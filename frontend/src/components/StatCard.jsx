import "./StatCard.css";

// The refresh stat tile: a serif number over an uppercase tracked label.
// `tone` tints the number to a status colour (active/archived/expired/closed/
// pending). Pass `iconTone` (and optionally `icon`) to render the small rounded
// icon tile used on the analytics KPIs — the tile shows even with no glyph.
// Namespaced (oq-).
export default function StatCard({
  value,
  label,
  tone,
  icon,
  iconTone,
  className = "",
}) {
  const showIcon = icon != null || iconTone;
  return (
    <div className={`oq-stat${className ? ` ${className}` : ""}`}>
      {showIcon && (
        <span
          className={`oq-stat__icon${
            iconTone ? ` oq-stat__icon--${iconTone}` : ""
          }`}
        >
          {icon}
        </span>
      )}
      <div className={`oq-stat__num${tone ? ` oq-stat__num--${tone}` : ""}`}>
        {value}
      </div>
      <div className="oq-stat__label">{label}</div>
    </div>
  );
}
