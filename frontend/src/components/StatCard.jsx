import "./StatCard.css";

// The refresh stat tile: a serif number over an uppercase tracked label.
// `tone` tints the number to a status colour (active/archived/expired/closed/
// pending). Pass `iconTone` (and optionally `icon`) to render the small rounded
// icon tile used on the analytics KPIs — the tile shows even with no glyph.
// Pass `onClick` to make the tile a real, keyboard-operable button (a plain
// <div> otherwise) — used for KPIs that drill into another view.
// Namespaced (oq-).
export default function StatCard({
  value,
  label,
  tone,
  icon,
  iconTone,
  className = "",
  onClick,
}) {
  const showIcon = icon != null || iconTone;
  const classes = `oq-stat${className ? ` ${className}` : ""}`;
  const content = (
    <>
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
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
