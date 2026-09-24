import logger from "../config/logger.js";
import { captureException } from "../config/sentry.js";

// Translates a thrown error into a JSON response.
// AppError carries an explicit HTTP status + a safe, user-facing message;
// anything else is treated as an unexpected 500 with a generic message
// (so internal details never leak to the client).

export const respondError = (res, error) => {
  const isUnexpected = !error.status;

  // A routine AppError (400/403/404/...) is an expected outcome, not a bug —
  // logged at warn for visibility, never sent to error tracking. An
  // unexpected error (no .status, i.e. would 500) is the one that means
  // something actually broke.
  if (isUnexpected) {
    logger.error({ err: error }, error.message);
    captureException(error);
  } else {
    logger.warn({ status: error.status }, error.message);
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : "Server error",
  });
};

export default respondError;
