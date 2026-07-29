import multer from "multer";

// Profile images are parsed into memory and handed to the storage port, which
// decides where the bytes live (local disk in development, R2 in production).
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Profile image must be a JPG, PNG or WebP"), false);
  }
};

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter,
});
