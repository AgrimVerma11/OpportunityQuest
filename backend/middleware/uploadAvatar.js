import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Profile images are meant to be displayed (an avatar next to a name), so they
// live under the public /uploads mount — unlike résumés, which are private.
export const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");

if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const ALLOWED = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    cb(null, `${unique}${ALLOWED[file.mimetype] || ".img"}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Profile image must be a JPG, PNG or WebP"), false);
  }
};

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter,
});
