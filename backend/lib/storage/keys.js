import crypto from "crypto";

// Every stored object is addressed by a key of the form "<folder>/<random>.<ext>".
// The top-level folder is meaningful: it decides the object's visibility, and
// for the local provider, which directory it lives in. Keys are server-generated
// and unguessable — no user input ever reaches a path.

export const AREA = {
  avatars: "public",
  attachments: "public",
  resumes: "private",
};

// Resolves the visibility area for a key from its folder prefix. An unknown
// prefix is a programming error, not user input, so it throws.
export const areaForKey = (key) => {
  const folder = String(key).split("/")[0];
  const area = AREA[folder];
  if (!area) {
    throw new Error(`Unknown storage key prefix: "${folder}"`);
  }
  return area;
};

const EXT_FOR_IMAGE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const token = () =>
  `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;

export const avatarKey = (mimetype) =>
  `avatars/${token()}.${EXT_FOR_IMAGE[mimetype] || "img"}`;

export const resumeKey = () => `resumes/${token()}.pdf`;

export const attachmentKey = () => `attachments/${token()}.pdf`;
