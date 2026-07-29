// Wraps an express-rate-limit store so that a backing-store outage fails OPEN:
// if the store errors, the request is allowed through rather than rejected. A
// rate limiter that 500s the entire API because the cache blipped is worse than
// one that briefly stops counting. Enforcement resumes on its own once the
// store recovers. The critical path is increment(); the rest degrade quietly.
export class ResilientStore {
  constructor(store) {
    this.store = store;
    this.windowMs = 60_000;
    // Reflect the wrapped store's own declarations where present.
    this.localKeys = store.localKeys;
    this.prefix = store.prefix;
  }

  init(options) {
    this.windowMs = options.windowMs;
    if (typeof this.store.init !== "function") return;

    // The wrapped store loads a Lua script here, returning a promise that
    // rejects if the client isn't connected yet — which is the normal case at
    // startup, since the connection opens asynchronously just after. Swallow it
    // so the rejection is never unhandled (that would crash the process). This
    // is safe and quiet on purpose: the store reloads the script on the next
    // increment, and a genuine, persistent outage is reported by the increment
    // path (which fails open and logs), so there is nothing to surface here.
    const result = this.store.init(options);
    if (result && typeof result.then === "function") {
      result.catch(() => {});
    }
  }

  async get(key) {
    try {
      return typeof this.store.get === "function"
        ? await this.store.get(key)
        : undefined;
    } catch {
      return undefined;
    }
  }

  async increment(key) {
    try {
      return await this.store.increment(key);
    } catch (err) {
      console.error(
        "Rate-limit store unavailable, allowing request:",
        err.message
      );
      // One hit, well under any ceiling, so the request proceeds.
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    try {
      await this.store.decrement(key);
    } catch {
      /* best effort */
    }
  }

  async resetKey(key) {
    try {
      await this.store.resetKey(key);
    } catch {
      /* best effort */
    }
  }

  async resetAll() {
    try {
      if (typeof this.store.resetAll === "function") await this.store.resetAll();
    } catch {
      /* best effort */
    }
  }
}
