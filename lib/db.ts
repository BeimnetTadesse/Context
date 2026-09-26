import postgres from "postgres";

// One pooled connection per server process. In dev, Next.js hot-reloads modules,
// so we park the client on globalThis to avoid opening a new pool on every edit.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
