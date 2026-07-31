import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import "./ConfirmDialog.css";

/* App-wide confirmation dialog.
 * The local host popup was hella annoying and looked very unbrandedd and basic so i made my own. This component is meant to be used for any action that needs confirmation, like deleting something or navigating away with unsaved changes.
 * Replaces the browser's blocking window.confirm() (which is what triggers
 * the "[Violation] 'click' handler took …" warning, and which can't be
 * styled or branded). Exposes a promise-based API:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, confirmLabel, tone })) { ... }
 *
 * Resolves true on confirm, false on cancel / dismiss.
 */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const trigger = useRef(null);
  const titleId = useId();
  const messageId = useId();

  const confirm = useCallback((options = {}) => {
    // Remember what had focus so we can restore it when the dialog closes.
    trigger.current = document.activeElement;
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({
        title: options.title || "Are you sure?",
        message: options.message || "",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone === "danger" ? "danger" : "primary",
      });
    });
  }, []);

  const settle = useCallback((result) => {
    setState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
    // Return focus to whatever triggered the confirm.
    trigger.current?.focus?.();
    trigger.current = null;
  }, []);

  // Esc cancels, Enter confirms while the dialog is open.
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state && (
        <div
          className="confirm-overlay"
          onClick={(e) => e.target === e.currentTarget && settle(false)}
        >
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={state.message ? messageId : undefined}
          >
            <h3 className="confirm-title" id={titleId}>
              {state.title}
            </h3>
            {state.message && (
              <p className="confirm-message" id={messageId}>
                {state.message}
              </p>
            )}
            <div className="confirm-actions">
              <button
                className="btn btn-secondary"
                onClick={() => settle(false)}
              >
                {state.cancelLabel}
              </button>
              <button
                className={`btn ${
                  state.tone === "danger" ? "btn-danger" : "btn-primary"
                }`}
                onClick={() => settle(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}
