import "./Card.css";

// The refresh surface: paper fill, warm hairline, 16px radius. Panel elevation
// by default; pass `elevated` for the softer card lift used on opportunity
// cards. Polymorphic via `as`. Namespaced (oq-) so it coexists with the
// legacy .card in global.css until cleanup.
export default function Card({
  as = "div",
  elevated = false,
  className = "",
  children,
  ...rest
}) {
  const As = as; // capitalized so JSX renders it as a component/tag
  const cls = `oq-card${elevated ? " oq-card--elevated" : ""}${
    className ? ` ${className}` : ""
  }`;
  return (
    <As className={cls} {...rest}>
      {children}
    </As>
  );
}
