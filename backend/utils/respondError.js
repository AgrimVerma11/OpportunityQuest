// Translates a thrown error into a JSON response.
// AppError carries an explicit HTTP status + a safe, user-facing message;
// anything else is treated as an unexpected 500 with a generic message
// (so internal details never leak to the client).

export const respondError = (res, error) => {
  console.error(error);
  res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : "Server error",
  });
};

export default respondError;
