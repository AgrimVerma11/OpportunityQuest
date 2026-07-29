import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

// Verifies that REDIS_URL points at a working Redis (e.g. Upstash): connects,
// PINGs, and round-trips a throwaway key. Run once after setting REDIS_URL:
//
//   node scripts/verifyRedis.js
//
// It writes only a short-lived test key and deletes it; nothing is left behind.

async function run() {
  if (!process.env.REDIS_URL) {
    console.error("REDIS_URL is not set. Nothing to verify.");
    process.exit(1);
  }

  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
  });

  try {
    const pong = await client.ping();
    console.log(`  ✓ PING → ${pong}`);

    const key = `verify:${Date.now()}`;
    await client.set(key, "ok", "EX", 30);
    const value = await client.get(key);
    if (value !== "ok") {
      throw new Error(`GET returned "${value}", expected "ok"`);
    }
    console.log(`  ✓ SET / GET round-trip (${key})`);

    await client.del(key);
    console.log("  ✓ DEL");

    console.log("\n✓ Redis is reachable and working.");
  } finally {
    client.disconnect();
  }
}

run().catch((err) => {
  console.error("\n✗ Redis check FAILED:", err.message);
  process.exit(1);
});
