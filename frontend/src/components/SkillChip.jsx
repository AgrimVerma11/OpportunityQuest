import "./SkillChip.css";

// A bordered, neutral chip for skills / tags — deliberately distinct from the
// coloured <Tag> pill. Namespaced (oq-).
export default function SkillChip({ children }) {
  return <span className="oq-skill">{children}</span>;
}
