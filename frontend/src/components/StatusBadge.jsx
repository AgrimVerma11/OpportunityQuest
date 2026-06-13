import "./StatusBadge.css";

// Color-coded pill for an application status. Shared across the student and
// faculty application views so the colors stay consistent.
export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}
