import "./Badge.css";

// A small, low-emphasis label for categories, counts, and metadata. `tone` maps
// to the shared palette. (Application/account statuses use StatusBadge, which
// carries their own fixed semantics.)
export default function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
