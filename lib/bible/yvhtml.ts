// Parse YouVersion Platform passage HTML (format=html) into verse texts. Pure, so it is unit-tested.

export interface YvChapter {
  verses: Record<number, string>;
  /** Combined verses: first verse → last verse (e.g. NASV Romans 16:25–26 is one verse). */
  spans: Record<number, number>;
}

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/**
 * Split YouVersion's passage HTML into verses. Each verse starts at <span class="yv-v" v="N" [ev="M"]>,
 * followed by a label span we drop; text runs until the next marker, across paragraph and poetry divs.
 */
export function parsePassageHtml(html: string): YvChapter {
  const verses: Record<number, string> = {};
  const spans: Record<number, number> = {};
  const body = html
    .replace(/<span class="yv-vlbl">[^<]*<\/span>/g, "")
    .replace(/<\/div>/g, " ") // paragraph / poetry line ends: keep words apart
    .replace(/<span class="yv-v"([^>]*)><\/span>/g, (_, attrs: string) => `\u0000${attrs}\u0001`);
  let current = 0;
  for (const part of body.split("\u0000")) {
    const end = part.indexOf("\u0001");
    let text = part;
    if (end >= 0) {
      const attrs = part.slice(0, end);
      current = Number(/\bv="(\d+)"/.exec(attrs)?.[1] ?? 0);
      const last = Number(/\bev="(\d+)"/.exec(attrs)?.[1] ?? 0);
      if (current && last > current) spans[current] = last;
      text = part.slice(end + 1);
    }
    if (!current) continue;
    verses[current] = (verses[current] ?? "") + decode(text.replace(/<[^>]+>/g, ""));
  }
  const nums = Object.keys(verses).map(Number).sort((a, b) => a - b);
  for (const [i, v] of nums.entries()) {
    let t = verses[v].replace(/\s+/g, " ").trim();
    // An opening bracket for a disputed next verse sits before its marker: give it to that verse.
    const next = nums[i + 1];
    if (next && t.endsWith("[")) {
      t = t.slice(0, -1).trimEnd();
      verses[next] = "[" + verses[next];
    }
    verses[v] = t;
  }
  return { verses, spans };
}
