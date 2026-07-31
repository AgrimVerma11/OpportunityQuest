import { IconClock } from "./Icons";
import "./DeadlineChip.css";

// Days remaining until a deadline (negative if past). Drives the urgency chip.
function deadlineInfo(deadline) {
  if (!deadline) return null;
  const days = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return { label: "Closed", tone: "past" };
  if (days === 0) return { label: "Last day", tone: "urgent" };
  if (days === 1) return { label: "1 day left", tone: "urgent" };
  if (days <= 5) return { label: `${days} days left`, tone: "soon" };
  return { label: `${days} days left`, tone: "normal" };
}

// A small urgency chip for an opportunity deadline. Shared by the feed and the
// detail page so "closing soon" reads the same everywhere.
export default function DeadlineChip({ deadline }) {
  const info = deadlineInfo(deadline);
  if (!info) return null;
  return (
    <span className={`deadline-chip deadline-chip-${info.tone}`}>
      <IconClock /> {info.label}
    </span>
  );
}
