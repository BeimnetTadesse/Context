"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { sql } from "@/lib/db";
import { currentViewer } from "@/lib/user";

// Profile actions. Each one works out who is asking on the server: it only ever touches the caller's own data.

async function readerId() {
  const viewer = await currentViewer();
  if (!viewer.id) redirect("/account");
  return { id: viewer.id, signedIn: viewer.signedIn };
}

function refresh() {
  revalidatePath("/account");
  revalidatePath("/notebook");
}

export async function deleteNotesAction() {
  const { id } = await readerId();
  await sql`delete from notes where user_id = ${id} and kind <> 'text_issue'`;
  refresh();
}

export async function deleteHighlightsAction() {
  const { id } = await readerId();
  await sql`delete from highlights where user_id = ${id}`;
  refresh();
}

export async function resetQuizAction() {
  const { id } = await readerId();
  await sql`delete from assumption_guesses where user_id = ${id}`;
  refresh();
}

/** Delete the account (or this device's data) and everything in it. Requires typing DELETE. */
export async function deleteAccountAction(form: FormData) {
  if (form.get("confirm") !== "DELETE") return;
  const { id, signedIn } = await readerId();
  // Notes, highlights and quiz answers go with the user (on delete cascade); logged AI questions stay, unlinked.
  await sql`delete from users where id = ${id}`;
  (await cookies()).delete("cid");
  if (signedIn) await signOut({ redirectTo: "/account/deleted" });
  redirect("/account/deleted");
}
