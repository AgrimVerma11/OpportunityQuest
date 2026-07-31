import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { IconCheck, IconAlert, IconInfo, IconX } from "./Icons";
import "./Toast.css";

/* App-wide toast notifications — brief, non-blocking feedback for an action
 * ("Saved", "Couldn't send"). Promise-free, imperative API:
 *
 *   const toast = useToast();
 *   toast.success("Opportunity published");
 *   toast.error("Something went wrong");
 *
 * Toasts auto-dismiss, can be dismissed manually, and are announced to screen
 * readers (polite for success/info, assertive for errors).
 */

const ToastContext = createContext(null);

const ICONS = {
  success: <IconCheck />,
  error: <IconAlert />,
  info: <IconInfo />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, type = "info", duration = 4000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      show,
      success: (m, d) => show(m, "success", d),
      error: (m, d) => show(m, "error", d),
      info: (m, d) => show(m, "info", d),
      dismiss,
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-host" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.type}`}
              role={t.type === "error" ? "alert" : "status"}
            >
              <span className="toast-icon" aria-hidden="true">
                {ICONS[t.type]}
              </span>
              <span className="toast-message">{t.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <IconX />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
