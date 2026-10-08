import { json } from "@/lib/api";
import { getAccount, getNotebook } from "@/lib/data/account";
import { currentViewer } from "@/lib/user";

// GET → a JSON file of everything this reader has saved ("Download my data").
export async function GET() {
  const viewer = await currentViewer();
  if (!viewer.id) return json({ error: "not_found" }, 404);
  const [account, notebook] = await Promise.all([getAccount(viewer.id), getNotebook(viewer.id)]);
  const data = {
    exported_at: new Date().toISOString(),
    account: { name: viewer.name, email: viewer.email, member_since: account?.created_at ?? null },
    notes: notebook.notes.map((n) => ({ kind: n.kind, passage: `${n.book} ${n.chapter}${n.verse ? `:${n.verse}` : ""}`, prompt: n.prompt, text: n.body, saved: n.created_at })),
    highlights: notebook.highlights.map((h) => ({ passage: `${h.book} ${h.chapter}:${h.verse}`, color: h.color, verse: h.text, saved: h.created_at })),
    quiz_answers: notebook.guesses.map((g) => ({ passage: `${g.book} ${g.chapter}`, statement: g.statement, your_label: g.guess, context_label: g.expected })),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="context-my-data.json"', "cache-control": "private, no-store" },
  });
}
