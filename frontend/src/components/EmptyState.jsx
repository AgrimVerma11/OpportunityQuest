import { IconInbox } from "./Icons";
import "./EmptyState.css";

// A calm, consistent empty state: an optional icon, a title, a short line of
// guidance, and an optional action. Used wherever a list or view has nothing to
// show, so "nothing here" always reads as intentional rather than broken.
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon || <IconInbox />}
      </span>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
