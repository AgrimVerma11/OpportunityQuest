import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Resumes are personal data. They are stored in a private directory that is
// NOT part of the public /uploads static mount, and are served only through
// an authorized streaming route.
export const RESUME_DIR = path.join(process.cwd(), "storage", "resumes");

if (!fs.existsSync(RESUME_DIR)) {
  fs.mkdirSync(RESUME_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RESUME_DIR),
  filename: (req, file, cb) => {
    // Server-generated, unguessable name; no user input in the path.
    const unique = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;
    cb(null, `${unique}.pdf`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF resumes are allowed"), false);
  }
};

export const uploadResume = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});
