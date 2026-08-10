import { useRef, useState } from "react";

import { IconFile, IconPlus } from "./Icons";
import Button from "./Button";
import "./AttachmentField.css";

// PDF attachment picker + list, shared by Create (pending files) and Edit
// (uploaded attachments). Items are { key, name, href? }; validation (PDF, 5MB)
// lives here so both pages get it for free.
export default function AttachmentField({
  label = "PDF attachments",
  hint,
  items = [],
  onAdd,
  onRemove,
  emptyText,
  addLabel = "Add PDF",
  busy = false,
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const pick = (e) => {
    const file = e.target.files[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5MB.");
      return;
    }
    onAdd(file);
  };

  return (
    <div className="attach">
      {(label || hint) && (
        <div className="attach-head">
          {label && <span className="attach-label">{label}</span>}
          {hint && <span className="attach-hint">{hint}</span>}
        </div>
      )}

      {items.length > 0 ? (
        <ul className="attach-list">
          {items.map((it) => (
            <li key={it.key} className="attach-item">
              {it.href ? (
                <a
                  href={it.href}
                  target="_blank"
                  rel="noreferrer"
                  className="attach-name"
                >
                  <IconFile />
                  <span>{it.name}</span>
                </a>
              ) : (
                <span className="attach-name">
                  <IconFile />
                  <span>{it.name}</span>
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="attach-remove"
                onClick={() => onRemove(it)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : emptyText ? (
        <p className="attach-empty">{emptyText}</p>
      ) : null}

      {error && <p className="field-error">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={pick}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="attach-add"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <IconPlus /> {busy ? "Uploading…" : addLabel}
      </Button>
    </div>
  );
}
