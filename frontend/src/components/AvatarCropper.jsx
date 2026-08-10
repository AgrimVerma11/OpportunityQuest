import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Button from "./Button";
import "./AvatarCropper.css";

const BOX = 300; // crop viewport size (px)
const OUT = 400; // exported image size (px)

// Lightweight circular image cropper: drag to reposition, slider to zoom.
// The visible square is exported (displayed round everywhere via Avatar), and
// panning is clamped so the image always covers the frame.
export default function AvatarCropper({ file, onCancel, onSave }) {
  const imgRef = useRef(null);
  const drag = useRef(null);

  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const baseScale = natural ? BOX / Math.min(natural.w, natural.h) : 1;
  const dispW = natural ? natural.w * baseScale * zoom : BOX;
  const dispH = natural ? natural.h * baseScale * zoom : BOX;

  const clamp = useCallback(
    (o, w, h) => ({
      x: Math.min(0, Math.max(BOX - w, o.x)),
      y: Math.min(0, Math.max(BOX - h, o.y)),
    }),
    []
  );

  const onImgLoad = (e) => {
    const w = e.target.naturalWidth;
    const h = e.target.naturalHeight;
    setNatural({ w, h });
    const bs = BOX / Math.min(w, h);
    setOffset({ x: (BOX - w * bs) / 2, y: (BOX - h * bs) / 2 });
  };

  // Keep the image covering the frame whenever the zoom changes.
  const handleZoom = (z) => {
    setZoom(z);
    if (!natural) return;
    const w = natural.w * baseScale * z;
    const h = natural.h * baseScale * z;
    setOffset((o) => clamp(o, w, h));
  };

  const startDrag = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onMove = (e) => {
    if (!drag.current) return;
    const next = {
      x: drag.current.ox + (e.clientX - drag.current.sx),
      y: drag.current.oy + (e.clientY - drag.current.sy),
    };
    setOffset(clamp(next, dispW, dispH));
  };

  const endDrag = () => {
    drag.current = null;
  };

  const handleSave = () => {
    if (!imgRef.current || !natural) return;
    setSaving(true);
    const scale = baseScale * zoom;
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sSize = BOX / scale;

    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, OUT, OUT);

    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) onSave(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div
      className="cropper-overlay"
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div className="cropper-card">
        <h3>Adjust your photo</h3>
        <p className="cropper-hint">Drag to reposition, use the slider to zoom.</p>

        <div
          className="cropper-stage"
          style={{ width: BOX, height: BOX }}
          onPointerDown={startDrag}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          <div className="cropper-circle" />
        </div>

        <input
          type="range"
          className="cropper-zoom"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(e) => handleZoom(parseFloat(e.target.value))}
        />

        <div className="cropper-actions">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save photo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
