import postgres from "postgres";

// One pooled connection per server process. In dev, Next.js hot-reloads modules,
// so we park the client on globalThis to avoid opening a new pool on every edit.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    max: 5,
    idle_timeout: 20,
    // Neon's pooled endpoint (PgBouncer, transaction mode) doesn't support prepared statements.
    prepare: false,
    // A sleeping Neon database takes a moment to wake; give it time rather than failing.
    connect_timeout: 15,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
