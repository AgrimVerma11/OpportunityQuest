// Lightweight error carrying an HTTP status code, so services can signal
// 400/403/404 etc. and controllers can translate them without string matching.

export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export default AppError;
