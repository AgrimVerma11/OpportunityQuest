import "./CategoryTag.css";

// The colour-coded label for an opportunity's category (Internship, Research,
// Paid Gig, Faculty Project). One place owns the category → tint mapping so the
// feed, detail page, and application lists all read the same.
export default function CategoryTag({ category }) {
  if (!category) return null;
  const slug = category.toLowerCase().replace(/\s+/g, "-");
  return <span className={`category-tag category-tag-${slug}`}>{category}</span>;
}
