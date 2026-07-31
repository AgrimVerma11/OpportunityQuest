import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { IconX } from "./Icons";
import "./Modal.css";

// Accessible dialog primitive. One implementation for the whole app, replacing
// the per-page overlays. Handles: portal render, role="dialog" + aria-modal,
// labelling by the title, Escape to close, overlay click to close, body scroll
// lock, an initial focus target, a focus trap, and return-focus on close.
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  labelledBy,
}) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  // Track the latest onClose in a ref so the focus/scroll-lock effect below can
  // depend only on `open`. Depending on `onClose` (a fresh inline function on
  // most callers) would re-run that effect on every keystroke and steal focus
  // from inputs inside the dialog.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the first focusable element (or the dialog itself).
    const focusables = () =>
      dialogRef.current?.querySelectorAll(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
      ) ?? [];
    const first = focusables()[0];
    (first ?? dialogRef.current)?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(focusables());
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? titleId : undefined)}
        ref={dialogRef}
        tabIndex={-1}
      >
        {title && (
          <header className="modal-head">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <IconX />
            </button>
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
