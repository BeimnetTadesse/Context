import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

// Anonymous, device-scoped identity: a random id in an httpOnly cookie → a users row.
// Enough to keep your notes and quiz answers private to this browser without passwords.
// Swap for real sign-in (Auth.js) later; notes.user_id stays the same.
const COOKIE = "cid";

export async function currentUserId(): Promise<number | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const [u] = await sql<{ id: number }[]>`select id from users where device_id = ${id}`;
  return u?.id ?? null;
}

/** Route handlers only (cookies can be set there, not in pages). */
export async function ensureUserId(): Promise<number> {
  const existing = await currentUserId();
  if (existing) return existing;
  const deviceId = randomUUID();
  const [u] = await sql<{ id: number }[]>`insert into users (device_id) values (${deviceId}) returning id`;
  (await cookies()).set(COOKIE, deviceId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 * 2 });
  return u.id;
}

/** Local curator mode: lets you verify claims. Never on in production unless explicitly set. */
export const curatorMode = () => process.env.CONTEXT_CURATOR === "1";
