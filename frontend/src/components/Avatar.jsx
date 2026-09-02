import { fileUrl } from "../utils/api";
import "./Avatar.css";

// Renders a user's profile image when set, otherwise their initial. Size is in
// pixels and drives both the box and the fallback initial.
export default function Avatar({ name, image, size = 40 }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const style = { width: size, height: size };

  if (image) {
    return (
      <img
        className="avatar avatar-img"
        src={fileUrl(image)}
        alt={name || "Profile"}
        style={style}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className="avatar avatar-initial"
      style={{ ...style, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  );
}
