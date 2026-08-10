import "./UrgencyChip.css";

// Days remaining until a deadline, mapped to an urgency level.
// Thresholds (from the mockups): low > 7d · mid 4–7d · high ≤ 3d.
function urgencyInfo(deadline) {
  if (!deadline) return null;
  const days = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return { label: "Closed", level: "high" };
  if (days === 0) return { label: "Last day", level: "high" };
  if (days === 1) return { label: "1 day left", level: "high" };
  if (days <= 3) return { label: `${days} days left`, level: "high" };
  if (days <= 7) return { label: `${days} days left`, level: "mid" };
  return { label: `${days} days left`, level: "low" };
}

// The refresh "N days left" chip. Replaces DeadlineChip once every surface
// has migrated.
export default function UrgencyChip({ deadline }) {
  const info = urgencyInfo(deadline);
  if (!info) return null;
  return (
    <span className={`oq-urgency oq-urgency--${info.level}`}>{info.label}</span>
  );
}
