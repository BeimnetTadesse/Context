import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/Workspace";
import type { ReadMode } from "@/components/workspace/ReadStep";
import { getChapter, getNtBooks } from "@/lib/data/chapter";
import { getStudy } from "@/lib/data/study";
import { sql } from "@/lib/db";
import type { Label } from "@/lib/labels";
import { isStepKey } from "@/lib/steps";
import { curatorMode, currentUserId } from "@/lib/user";

const MODES: ReadMode[] = ["web", "amh", "parallel", "greek"];

export async function generateMetadata(props: PageProps<"/study/[book]/[chapter]">): Promise<Metadata> {
  const { book, chapter } = await props.params;
  const data = await getChapter(book, Number(chapter));
  return { title: data ? `${data.book.name} ${data.chapter} · Context` : "Context" };
}

export default async function StudyPage(props: PageProps<"/study/[book]/[chapter]">) {
  const { book, chapter } = await props.params;
  const { step } = await props.searchParams;
  const [data, books, userId] = await Promise.all([getChapter(book, Number(chapter)), getNtBooks(), currentUserId()]);
  if (!data) notFound();

  const study = await getStudy(data.book, data.chapter, data.verses);
  const saved = (await cookies()).get("readMode")?.value as ReadMode | undefined;

  // This reader's private state for the chapter.
  const [guessRows, noteRows, countRows] = userId
    ? await Promise.all([
        sql<{ item_id: number; guess: Label }[]>`
          select g.item_id, g.guess from assumption_guesses g join reflection_items r on r.id = g.item_id
          where g.user_id = ${userId} and r.book_id = ${data.book.id} and r.chapter = ${data.chapter}`,
        sql<{ id: number; kind: string; item_id: number | null; body: string }[]>`
          select id, kind, item_id, body from notes
          where user_id = ${userId} and book_id = ${data.book.id} and chapter = ${data.chapter} order by created_at desc`,
        sql<{ n: number }[]>`select count(*)::int as n from notes where user_id = ${userId} and kind <> 'text_issue'`,
      ])
    : [[], [], [{ n: 0 }]];

  return (
    <Workspace
      data={data}
      books={books}
      study={study}
      curator={curatorMode()}
      initialStep={isStepKey(step) ? step : "read"}
      initialMode={saved && MODES.includes(saved) ? saved : "web"}
      noteCount={countRows[0]?.n ?? 0}
      guesses={Object.fromEntries(guessRows.map((g) => [g.item_id, g.guess]))}
      notes={noteRows.map((n) => ({ id: n.id, kind: n.kind, itemId: n.item_id, body: n.body }))}
    />
  );
}
