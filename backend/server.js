// Loaded first, as a side-effecting import, so environment variables are in
// place before any other module is evaluated. Some config (e.g. the storage
// driver) is resolved at import time, so a later dotenv.config() would be read
// too late and silently fall back to defaults.
import "dotenv/config";

import connectDB from "./config/db.js";
import { createApp } from "./app.js";

// Fail fast if critical secrets are missing rather than signing tokens
// with `undefined` (which would silently break auth).
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}

const app = createApp();

connectDB();

const PORT = process.env.PORT || 5174;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
