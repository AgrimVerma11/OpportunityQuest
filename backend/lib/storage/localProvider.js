import fs from "fs";
import fsp from "fs/promises";
import path from "path";

import config from "../../config/storage.js";

// Filesystem-backed storage for development and tests. Public objects are
// written under the directory Express serves statically; private objects are
// written outside it and are only reachable by streaming them back through an
// authorized route. This mirrors the pre-object-storage behavior exactly, so
// the test suite and local development need no cloud credentials.

const rootFor = (area) =>
  area === "public" ? config.publicRoot : config.privateRoot;

const pathFor = (key, area) => path.join(process.cwd(), rootFor(area), key);

export const put = async (key, area, { body }) => {
  const filePath = pathFor(key, area);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, body);
};

export const remove = async (key, area) => {
  try {
    await fsp.unlink(pathFor(key, area));
  } catch (err) {
    // A missing file is already the desired end state.
    if (err.code !== "ENOENT") throw err;
  }
};

export const getStream = async (key, area) => {
  const filePath = pathFor(key, area);
  try {
    const { size } = await fsp.stat(filePath);
    return { stream: fs.createReadStream(filePath), contentLength: size };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
};

export const publicUrl = (key) => `${config.publicUrlPrefix}/${key}`;

export const keyFromPublicUrl = (url) => {
  const prefix = `${config.publicUrlPrefix}/`;
  return url && url.startsWith(prefix) ? url.slice(prefix.length) : null;
};
