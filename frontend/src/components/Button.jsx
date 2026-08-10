import "./Button.css";

// The refresh button. Polymorphic via `as` (renders a <button> by default,
// pass `as={Link}` / `as="a"` for navigation). Variants and sizes come
// straight from the mockups:
//   variant: primary (ink fill) · outline (paper + hairline) ·
//            subtle (transparent + hairline) · text (gold, no chrome)
//   size:    md (default) · sm (card action rows)
// `leadingPlus` prepends the gold "+" used on the "Post an opportunity" CTA.
// Namespaced (oq-) so it never collides with the legacy .btn system.
export default function Button({
  as = "button",
  variant = "primary",
  size = "md",
  block = false,
  leadingPlus = false,
  className = "",
  children,
  ...rest
}) {
  const As = as; // capitalized so JSX renders it as a component/tag
  const cls = `oq-btn oq-btn--${variant} oq-btn--${size}${
    block ? " oq-btn--block" : ""
  }${className ? ` ${className}` : ""}`;
  return (
    <As className={cls} {...rest}>
      {leadingPlus && (
        <span className="oq-btn__plus" aria-hidden="true">
          +
        </span>
      )}
      {children}
    </As>
  );
}
