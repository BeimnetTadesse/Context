// Applies db/migrations/*.sql in order, once each, recording them in schema_migrations.
// Run: npm run db:migrate
import { config } from "dotenv";
config({ path: ".env.local" });
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });
const dir = join(process.cwd(), "db/migrations");

async function main() {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())`;
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name));

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
