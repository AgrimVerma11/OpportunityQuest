import "./PageHeader.css";

// The shared page masthead: a compact header zone with an eyebrow, a title, an
// optional subtitle, and an optional action on the right. Every top-level page
// uses this so the app reads as one product.
export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <section className="page-header">
      <div className="container page-header-inner">
        <div className="page-header-main">
          {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="page-header-aside">{action}</div>}
      </div>
    </section>
  );
}
