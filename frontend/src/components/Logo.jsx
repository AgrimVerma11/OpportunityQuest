import { useId } from "react";

// Opportunity Quest brand mark: a faceted diamond (the opportunity) at the tip
// of a needle breaking through an open compass ring (the quest). Reproduced
// verbatim from public/brand/opportunity-quest-icon.svg — do not redraw the
// geometry. The app is single-theme (light surfaces), so this is the
// light-background variant of the mark.
export default function Logo({ size = 30, className, title = "Opportunity Quest" }) {
  // Unique, colon-free gradient id per instance so multiple marks on a page
  // don't collide (useId can contain ":", which breaks url(#…) references).
  const gid = `oq-gold-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 400 400"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF5A" />
          <stop offset="100%" stopColor="#9C7A2E" />
        </linearGradient>
      </defs>
      <path
        d="M 340.00 200.00 A 140 140 0 1 1 200.00 60.00"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <polygon points="260.10,149.80 325.87,74.13 250.20,139.90" fill={`url(#${gid})`} />
      <polygon points="255.15,144.85 231.11,231.11 144.85,255.15" fill="#20244A" />
      <polygon points="255.15,144.85 168.89,168.89 144.85,255.15" fill="#34386A" />
      <polygon
        points="255.15,144.85 231.11,231.11 144.85,255.15 168.89,168.89"
        fill="none"
        stroke="#14172E"
        strokeWidth="1.5"
      />
    </svg>
  );
}
