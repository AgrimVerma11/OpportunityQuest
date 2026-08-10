import { useId } from "react";
import "./PageHero.css";

// The refresh page masthead: a gold eyebrow over a serif title and subtitle,
// with a soft gold glow and (by default) a faint compass watermark. `action`
// renders at the top-right (usually a primary CTA); pass `mark={false}` on
// pages where content sits tight under the hero (e.g. the analytics tabs).
// Shared so every page opens on the same note.
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  action,
  mark = true,
}) {
  // Unique, colon-free gradient id so multiple heroes never collide.
  const gid = `pageHeroGold-${useId().replace(/:/g, "")}`;
  return (
    <section className="page-hero">
      {mark && (
        <svg
          className="page-hero-mark"
          viewBox="0 0 400 400"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
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
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.55"
          />
          <polygon
            points="255.15,144.85 231.11,231.11 144.85,255.15"
            fill="#20244A"
            opacity="0.12"
          />
          <polygon
            points="255.15,144.85 168.89,168.89 144.85,255.15"
            fill="#34386A"
            opacity="0.12"
          />
        </svg>
      )}

      <div className="container page-hero-inner">
        <div className="page-hero-text">
          {eyebrow && <div className="page-hero-eyebrow">{eyebrow}</div>}
          <h1 className="page-hero-title">{title}</h1>
          {subtitle && <p className="page-hero-sub">{subtitle}</p>}
        </div>
        {action && <div className="page-hero-action">{action}</div>}
      </div>
    </section>
  );
}
