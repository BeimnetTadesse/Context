import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

// Sign in with Google. Sessions are signed JWT cookies (no session table); our own users table
// holds the account, keyed by email. Reading stays public — only saving needs an account.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.email) {
        const [u] = await sql<{ id: number }[]>`
          insert into users (email, name, image, last_sign_in)
          values (${profile.email}, ${profile.name ?? null}, ${(profile.picture as string | undefined) ?? null}, now())
          on conflict (email) do update set name = excluded.name, image = excluded.image, last_sign_in = now()
          returning id`;
        token.uid = u.id;
        await adoptDeviceNotes(u.id);
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = String(token.uid);
      return session;
    },
  },
});

/** Notes, highlights and quiz answers made on this device before signing in move into the account. */
async function adoptDeviceNotes(accountId: number) {
  const deviceId = (await cookies()).get("cid")?.value;
  if (!deviceId || !/^[0-9a-f-]{36}$/.test(deviceId)) return;
  const [device] = await sql<{ id: number }[]>`select id from users where device_id = ${deviceId} and email is null`;
  if (!device || device.id === accountId) return;
  await sql.begin(async (tx) => {
    await tx`update notes set user_id = ${accountId} where user_id = ${device.id}`;
    await tx`insert into assumption_guesses (user_id, item_id, guess, correct, created_at)
             select ${accountId}, item_id, guess, correct, created_at from assumption_guesses where user_id = ${device.id}
             on conflict (user_id, item_id) do nothing`;
    await tx`update ai_runs set user_id = ${accountId} where user_id = ${device.id}`;
    await tx`insert into highlights (user_id, ord, color, created_at)
             select ${accountId}, ord, color, created_at from highlights where user_id = ${device.id}
             on conflict (user_id, ord) do nothing`;
    await tx`delete from users where id = ${device.id}`;
  });
}
