// Parse a WordProject chapter page (wordproject.org/bibles/am/<book>/<chapter>.htm) into verses.
// A verse shown as "-" is printed combined with the next one (e.g. Matt 2:14–15 is one verse in the 1962
// Amharic Bible): we return null for it, and the caller attaches it to the verse that carries the text.

export interface WpVerse {
  verse: number;
  text: string | null;
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function parseWordProjectChapter(html: string): WpVerse[] {
  const start = html.indexOf('id="textBody"');
  const end = html.indexOf("<!-- /textBody -->");
  if (start < 0 || end < 0) return [];
  const body = html
    .slice(start, end)
    // Verse 1's marker is commented out on these pages.
    .replace(/<!--\s*span class="verse" id="(\d+)">[^<]*<\/span\s*-->/g, '<span class="verse" id="$1"></span>')
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<h3>[\s\S]*?<\/h3>/g, "")
    .replace(/<span class="verse" id="(\d+)">[^<]*<\/span>/g, "\u0000$1\u0001");
  const out: WpVerse[] = [];
  for (const part of body.split("\u0000").slice(1)) {
    const [num, rest] = part.split("\u0001");
    const text = decode(rest.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    out.push({ verse: Number(num), text: text === "-" || text === "" ? null : text });
  }
  return out;
}
