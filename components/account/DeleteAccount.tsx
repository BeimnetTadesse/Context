"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction } from "@/app/account/actions";

/** Deleting the account needs the word DELETE typed out: it can't be undone. */
export function DeleteAccount({ signedIn }: { signedIn: boolean }) {
  const [typed, setTyped] = useState("");
  return (
    <form action={deleteAccountAction} className="mt-4 flex flex-wrap items-center gap-3">
      <label className="text-sm text-ink-2">
        Type <b className="font-mono font-medium text-accent">DELETE</b> to confirm
        <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
          className="ml-3 w-36 rounded-lg border border-rule bg-paper px-3 py-1.5 font-mono text-sm focus:border-accent focus:outline-none" />
      </label>
      <Submit disabled={typed !== "DELETE"}>{signedIn ? "Delete my account" : "Delete this device’s data"}</Submit>
    </form>
  );
}

function Submit({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={disabled || pending} className="rounded-xl bg-accent px-4 py-2 text-sm text-paper disabled:cursor-not-allowed disabled:opacity-40">
      {pending ? "Deleting…" : children}
    </button>
  );
}
