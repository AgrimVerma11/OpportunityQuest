import config from "../../config/storage.js";
import { areaForKey } from "./keys.js";
import * as local from "./localProvider.js";
import * as r2 from "./r2Provider.js";

// The storage port. Everything above this line — services, controllers — deals
// only in keys and buffers; the visibility area (which bucket, which directory)
// is derived from the key prefix here, and which backend serves it is a single
// configuration switch. Swapping local disk for R2 is a config change, not a
// code change.

const provider = config.driver === "r2" ? r2 : local;

// Stores an object. `body` is a Buffer (multer memory storage); `contentType`
// is its MIME type, used by the CDN and by browsers.
export const put = (key, { body, contentType }) =>
  provider.put(key, areaForKey(key), { body, contentType });

// Deletes an object. Best-effort: a missing object is treated as success.
export const remove = (key) => provider.remove(key, areaForKey(key));

// Opens an object for reading. Resolves to { stream, contentType?,
// contentLength? }, or null if the object does not exist.
export const getStream = (key) => provider.getStream(key, areaForKey(key));

// The browser-facing URL for a public object.
export const publicUrl = (key) => provider.publicUrl(key);

// The inverse of publicUrl: recovers the key from a stored public URL so the
// object can be deleted. Returns null if the URL is not one we issued.
export const keyFromPublicUrl = (url) => provider.keyFromPublicUrl(url);
