import multer from "multer";

// Resumes are personal data. They are parsed into memory and handed to the
// storage port, which writes them to a private area — never publicly served,
// only streamed back through an authorized route.
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF resumes are allowed"), false);
  }
};

export const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});
