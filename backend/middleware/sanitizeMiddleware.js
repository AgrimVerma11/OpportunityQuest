// NoSQL-injection guard.
//
// Strips keys that could be interpreted as MongoDB query operators
// ($gt, $where, …) or dotted paths from request input. Mongoose's typed
// schemas already cast most values, but this adds defence-in-depth for any
// object reaching a query.
//
// Note: we mutate the objects in place (deleting keys) rather than
// reassigning req.query — which is a read-only getter in Express 5.

const isForbiddenKey = (key) => key.startsWith("$") || key.includes(".");

const scrub = (value) => {
  if (!value || typeof value !== "object") return;

  for (const key of Object.keys(value)) {
    if (isForbiddenKey(key)) {
      delete value[key];
      continue;
    }
    scrub(value[key]);
  }
};

const sanitize = (req, res, next) => {
  scrub(req.body);
  scrub(req.params);
  // Best-effort: harmless if Express re-parses the query string.
  try {
    scrub(req.query);
  } catch {
    /* req.query is read-only in some Express 5 setups — ignore */
  }
  next();
};

export default sanitize;
