"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { currentViewer, isOwner } from "@/lib/user";

/** Mark a text report fixed, or reopen it. Owner only. */
export async function setReportFixed(form: FormData) {
  if (!isOwner(await currentViewer())) notFound();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const fixed = form.get("fixed") === "1";
  await sql`update text_reports set resolved_at = ${fixed ? sql`now()` : null} where id = ${id}`;
  revalidatePath("/stats");
}
