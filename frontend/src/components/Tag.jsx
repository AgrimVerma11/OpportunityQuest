import "./Tag.css";

// Category slug → the tint used in the mockups.
const CATEGORY_SLUGS = {
  Internship: "internship",
  Research: "research",
  "Paid Gig": "paidgig",
  "Faculty Project": "faculty",
};

// Every status string the app uses, grouped onto the five status tints.
// Opportunity/faculty lifecycle statuses map directly; the richer application
// statuses fold onto the nearest tone (positive → active, in-progress →
// pending, negative → expired, neutral → closed/archived).
const STATUS_TONES = {
  Active: "active",
  Selected: "active",
  Shortlisted: "active",
  Approved: "active",
  Pending: "pending",
  Applied: "pending",
  Expired: "expired",
  Rejected: "expired",
  Closed: "closed",
  Withdrawn: "closed",
  Viewed: "closed",
  Archived: "archived",
  Suspended: "archived",
};

// The refresh pill. `category` renders an opportunity-type tint; `status`
// renders a lifecycle tint (active-style tones get a leading dot). Replaces
// CategoryTag and StatusBadge once every surface has migrated.
export default function Tag({ category, status, dot }) {
  if (status) {
    const tone = STATUS_TONES[status] || "closed";
    const showDot = dot ?? tone === "active";
    return (
      <span
        className={`oq-tag oq-tag--status oq-tag--status-${tone}${
          showDot ? " oq-tag--dot" : ""
        }`}
      >
        {status}
      </span>
    );
  }

  if (!category) return null;
  const slug =
    CATEGORY_SLUGS[category] || category.toLowerCase().replace(/\s+/g, "-");
  return <span className={`oq-tag oq-tag--cat oq-tag--cat-${slug}`}>{category}</span>;
}
