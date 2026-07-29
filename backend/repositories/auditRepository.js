import AuditLog from "../models/AuditLog.js";

// Repository — the only place that writes the audit trail. The trail is
// append-only by design: there is deliberately no update or delete here.

// Records one entry. When a session is passed, the write joins that transaction
// so it commits atomically with the state change it describes (or not at all).
export const record = async (entry, session) => {
  if (session) {
    const [created] = await AuditLog.create([entry], { session });
    return created;
  }
  return AuditLog.create(entry);
};
