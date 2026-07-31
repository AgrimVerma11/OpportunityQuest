import { cloneElement } from "react";
import "./Field.css";

// Accessible form field: a labelled control with optional hint and error. It
// wires the label to the control and sets aria-invalid / aria-describedby on it
// automatically, so every form gets correct associations for free — the child
// is any control (input / textarea / select) with `field-control` applied.
export default function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: `field-control${error ? " field-control-error" : ""}${
      children.props.className ? ` ${children.props.className}` : ""
    }`,
  });

  return (
    <div className="field">
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && (
            <span className="field-required" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
      )}
      {control}
      {hint && !error && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
