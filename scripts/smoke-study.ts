// Pipeline smoke test WITHOUT the model: run a hand-written fixture through the real validator + saveStudy.
// Usage: npm run study:smoke        (writes Ephesians 3)   ·   npm run study:smoke -- --clean   (removes it)
// The fixture only restates what the verses say; it exists to test the pipeline and UI, then is deleted.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { bookByOsis } = await import("../lib/bible/books");
  const { chapterEvidence } = await import("../lib/ai/evidence");
  const { saveStudy } = await import("../lib/study/generate");
  const { sql } = await import("../lib/db");
  const book = bookByOsis("Eph")!;

  if (process.argv.includes("--clean")) {
    for (const t of ["claims", "sections", "connections", "interp_questions", "reflection_items", "language_notes", "chapter_studies"])
      await sql`delete from ${sql(t)} where book_id = ${book.id} and chapter = 3`;
    console.log("fixture removed");
    return sql.end();
  }

  const pack = await chapterEvidence(book, 3, { lexicon: 20, xrefs: 30, claims: false });
  const V = (n: number) => `V:Eph.3.${n}`;
  const xrefs = pack.items.filter((i) => i.kind === "xref").slice(0, 3).map((i) => i.id);
  const lex = pack.items.filter((i) => i.kind === "lexicon").map((i) => i.id);
  console.log("lexicon in pack:", lex.join(" "));
  const L = lex.includes("L:G3466") ? "L:G3466" : lex[0];

  const fixture = {
    sections: [
      { start_verse: 1, end_verse: 1, title: "A prayer begins", summary: "“For this cause…” then breaks off mid-sentence." },
      { start_verse: 2, end_verse: 13, title: "Paul’s stewardship of the mystery", summary: "What was revealed, to whom, and Paul’s role in making it known." },
      { start_verse: 14, end_verse: 19, title: "The prayer resumes", summary: "“For this cause” repeated." },
      { start_verse: 20, end_verse: 21, title: "Doxology", summary: "Praise to God." },
    ],
    margin_notes: [
      { label: "explicit", statement: "Paul describes himself as a prisoner.", cites: [V(1)], quote: "the prisoner of Christ Jesus" },
      { label: "explicit", statement: "The chapter speaks of a mystery made known by revelation.", cites: [V(3), L], quote: "the mystery" },
      { label: "explicit", statement: "Gentiles are called fellow heirs.", cites: [V(6)], quote: "fellow heirs" },
      { label: "explicit", statement: "Paul calls himself the least of all saints.", cites: [V(8)], quote: "the very least of all saints" },
      { label: "scholarly", statement: "Lincoln argues the powers are purely political.", cites: ["S:Lincoln1990"], quote: "powers" },
    ],
    observations: [{ label: "explicit", statement: "“For this cause” opens both 3:1 and 3:14, bracketing 3:2–13.", cites: [V(1), V(14)], quote: null }],
    context: [
      { topic: "author", label: "explicit", statement: "The chapter names Paul as the speaker.", cites: [V(1)], quote: "Paul" },
      { topic: "audience", label: "explicit", statement: "The readers are addressed as Gentiles.", cites: [V(1)], quote: "you Gentiles" },
      { topic: "setting", label: "historical", statement: "The letter was written from Rome.", cites: [V(1)], quote: null },
    ],
    language: [
      { strongs: L.slice(2), meaning_here: "In this chapter: something not made known before, now revealed (3:3–5).",
        translation_note: null, caution: "English “mystery” suggests a puzzle; the chapter uses the word for something disclosed.",
        claims: [{ label: "historical", statement: "The lexicon lists this word’s range of meaning.", cites: [L], quote: null }] },
    ],
    connections: xrefs.map((x) => ({ xref: x, group: "Pipeline test", relation: "Cross-reference", explanation: "Fixture row (pipeline test)." })),
    interpretations: [
      { question: "What is “the mystery”?", start_verse: 3, end_verse: 6, common_ground: "Both readings take 3:6 as describing the mystery’s content.",
        views: [
          { title: "Gentile inclusion in one body", claims: [{ label: "inference", statement: "3:6 states the content directly.", cites: [V(6)], quote: null }] },
          { title: "A wider plan centred on Christ", claims: [{ label: "scholarly", statement: "One reading stresses “the mystery of Christ” (3:4).", cites: [V(4)], quote: null }] },
        ] },
    ],
    reflect_statements: [
      { text: "Paul asks that the readers be strengthened with power through the Spirit.", expected_label: "explicit", explanation: "Stated in the prayer.", cites: [V(16)] },
      { text: "Paul wrote Ephesians from a prison in Rome.", expected_label: "scholarly", explanation: "The text says he is a prisoner; it does not say where.", cites: [V(1)] },
      { text: "This chapter is about my own sense of belonging.", expected_label: "personal", explanation: "A reader’s response, not something the text states.", cites: [V(6)] },
    ],
    reflect_prompts: [
      { start_verse: 18, end_verse: 19, prompt: "Paul prays for knowledge of a love that “surpasses knowledge”. Where do you settle for knowing about something rather than knowing it?" },
      { start_verse: 6, end_verse: 6, prompt: "People once kept apart are described as fellow heirs. Who do you instinctively treat as a second-tier member?" },
    ],
  };

  const issues: { statement: string; problem: string }[] = [];
  await saveStudy(book, 3, fixture as never, pack, issues);
  console.log(`saved. validator issues (${issues.length}):`);
  for (const i of issues) console.log(`  - ${i.problem}  ←  ${i.statement}`);
  await sql.end();
}
main();
