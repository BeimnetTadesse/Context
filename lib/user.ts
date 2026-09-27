import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

// Who is this? A signed-in Google account if there is one; otherwise an anonymous device
// (a random id in an httpOnly cookie) so reading and trying things never requires signing in.
const COOKIE = "cid";

export interface Viewer {
  id: number | null;
  signedIn: boolean;
  name: string | null;
  image: string | null;
  email: string | null;
}

/** Sign-in is optional: without AUTH_SECRET (e.g. before it's configured on Vercel) everyone is a device user. */
export const authConfigured = () => Boolean(process.env.AUTH_SECRET);

export async function currentViewer(): Promise<Viewer> {
  const session = authConfigured() ? await auth().catch(() => null) : null;
  if (session?.user?.id) {
    return { id: Number(session.user.id), signedIn: true, name: session.user.name ?? null, image: session.user.image ?? null, email: session.user.email ?? null };
  }
  const deviceId = (await cookies()).get(COOKIE)?.value;
  if (!deviceId || !/^[0-9a-f-]{36}$/.test(deviceId)) return { id: null, signedIn: false, name: null, image: null, email: null };
  const [u] = await sql<{ id: number }[]>`select id from users where device_id = ${deviceId}`;
  return { id: u?.id ?? null, signedIn: false, name: null, image: null, email: null };
}

export async function currentUserId(): Promise<number | null> {
  return (await currentViewer()).id;
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
