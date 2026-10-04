"use client";

import { createContext, useContext } from "react";
import type { StudyData } from "@/lib/data/study";
import type { Book } from "@/lib/bible/books";

export interface StudyCtx {
  book: Book;
  chapter: number;
  study: StudyData;
  curator: boolean;
  /** The research assistant needs sign-in and this reader isn't signed in. */
  aiLocked: boolean;
  /** Word trail: highlight every occurrence of this English word in Read. */
  trail: string | null;
  setTrail: (w: string | null) => void;
  /** Open the Ask panel with a question pre-filled. */
  ask: (q: string) => void;
  /** Update the notebook counter after saving. */
  setNoteCount: (n: number) => void;
}

export const StudyContext = createContext<StudyCtx | null>(null);

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudy outside StudyContext");
  return ctx;
}

export async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message ?? "Request failed"), { code: data.error });
  return data as T;
}
