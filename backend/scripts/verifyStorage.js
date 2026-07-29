import dotenv from "dotenv";

dotenv.config();

// Verifies the configured storage driver end-to-end: stores, streams back, and
// deletes one object in each visibility area (public and private). Use it to
// confirm R2 is wired correctly once the buckets and credentials exist:
//
//   STORAGE_DRIVER=r2 node scripts/verifyStorage.js
//
// or set STORAGE_DRIVER=r2 (and the R2_* vars) in backend/.env and run:
//
//   node scripts/verifyStorage.js
//
// It writes only throwaway objects and deletes them; nothing is left behind.

const drain = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const roundTrip = async (storage, key, label) => {
  const body = Buffer.from(`opportunity-quest storage check ${Date.now()}`);

  await storage.put(key, { body, contentType: "text/plain" });

  const object = await storage.getStream(key);
  if (!object) throw new Error(`${label}: object was not found after upload`);

  const read = await drain(object.stream);
  if (!read.equals(body)) throw new Error(`${label}: streamed bytes did not match`);

  await storage.remove(key);
  if (await storage.getStream(key)) {
    throw new Error(`${label}: object still present after delete`);
  }

  console.log(`  ✓ ${label} — put, stream, delete (${key})`);
};

async function run() {
  // Imported after dotenv so config validation sees the loaded environment.
  const { default: config } = await import("../config/storage.js");
  const storage = await import("../lib/storage/index.js");

  console.log(`Storage driver: ${config.driver}\n`);

  await roundTrip(storage, `avatars/verify-${Date.now()}.txt`, "public bucket");
  await roundTrip(storage, `resumes/verify-${Date.now()}.txt`, "private bucket");

  console.log(
    `\n  Example public URL: ${storage.publicUrl("avatars/example.jpg")}`
  );
  console.log("\n✓ All storage checks passed.");
}

run().catch((err) => {
  console.error("\n✗ Storage check FAILED:", err.message);
  process.exit(1);
});
