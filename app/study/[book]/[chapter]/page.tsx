import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/Workspace";
import { getChapter, getNtBooks } from "@/lib/data/chapter";
import { isStepKey } from "@/lib/steps";
import type { ReadMode } from "@/components/workspace/ReadStep";

const MODES: ReadMode[] = ["web", "amh", "parallel", "greek"];

export async function generateMetadata(props: PageProps<"/study/[book]/[chapter]">): Promise<Metadata> {
  const { book, chapter } = await props.params;
  const data = await getChapter(book, Number(chapter));
  return { title: data ? `${data.book.name} ${data.chapter} · Context` : "Context" };
}

export default async function StudyPage(props: PageProps<"/study/[book]/[chapter]">) {
  const { book, chapter } = await props.params;
  const { step } = await props.searchParams;
  const [data, books] = await Promise.all([getChapter(book, Number(chapter)), getNtBooks()]);
  if (!data) notFound();
  const saved = (await cookies()).get("readMode")?.value as ReadMode | undefined;

  return (
    <Workspace
      data={data}
      books={books}
      initialStep={isStepKey(step) ? step : "read"}
      initialMode={saved && MODES.includes(saved) ? saved : "web"}
    />
  );
}
