"use server";

import { signIn, signOut } from "@/auth";

const safePath = (p: FormDataEntryValue | null) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/study");

export async function signInWithGoogle(form: FormData) {
  await signIn("google", { redirectTo: safePath(form.get("next")) });
}

export async function signOutAction(form: FormData) {
  await signOut({ redirectTo: safePath(form.get("next")) });
}
