// Storage configuration. The application reads and writes uploaded files
// through a provider port (see lib/storage); this module decides which provider
// backs that port and, for R2, fails fast at startup if a credential is missing
// rather than at the first upload.
//
// Two visibility areas exist. "public" objects (avatars, opportunity
// attachments) are served directly to browsers — from the static /uploads mount
// in development, or a CDN-fronted bucket in production. "private" objects
// (resumes) are never public; they are streamed back only through an authorized
// route.

const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `STORAGE_DRIVER=r2 requires ${name}. Set it, or use STORAGE_DRIVER=local.`
    );
  }
  return value;
};

let config;

if (driver === "r2") {
  config = {
    driver: "r2",
    accountId: required("R2_ACCOUNT_ID"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    publicBucket: required("R2_PUBLIC_BUCKET"),
    privateBucket: required("R2_PRIVATE_BUCKET"),
    // Public base URL of the public bucket (its r2.dev address or a custom
    // domain), with any trailing slash trimmed so keys join cleanly.
    publicBaseUrl: required("R2_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  };
} else if (driver === "local") {
  config = {
    driver: "local",
    // Public files live under the directory Express serves at /uploads.
    publicRoot: "uploads",
    // Private files live outside that directory and are never served statically.
    privateRoot: "storage",
    publicUrlPrefix: "/uploads",
  };
} else {
  throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use "local" or "r2".`);
}

export default config;
