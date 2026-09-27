// Versions a reader can choose. English texts are public domain; the Amharic is used under the
// Bible Society of Ethiopia's non-commercial terms (full copyright statement shown when displayed).
export const VERSIONS = [
  { code: "WEB", short: "WEB", name: "World English Bible", note: "Modern, readable; Majority Text" },
  { code: "BSB", short: "BSB", name: "Berean Standard Bible", note: "Modern, precise; critical text" },
  { code: "KJV", short: "KJV", name: "King James Version", note: "1611/1769; Textus Receptus" },
  { code: "ASV", short: "ASV", name: "American Standard Version", note: "1901; very literal" },
  { code: "YLT", short: "YLT", name: "Young's Literal Translation", note: "1862; word-for-word" },
  { code: "AMH", short: "አማርኛ", name: "Amharic Bible (1962)", note: "Haile Selassie translation" },
] as const;

export type VersionCode = (typeof VERSIONS)[number]["code"];
export const isVersion = (c: unknown): c is VersionCode => VERSIONS.some((v) => v.code === c);
export const versionInfo = (c: VersionCode) => VERSIONS.find((v) => v.code === c)!;

export interface ReadPrefs {
  primary: VersionCode;
  compare: VersionCode[]; // up to 2 extra columns
  greek: boolean;
}

export const DEFAULT_PREFS: ReadPrefs = { primary: "WEB", compare: [], greek: false };

export function parsePrefs(raw: string | undefined): ReadPrefs {
  try {
    const p = JSON.parse(raw ?? "");
    const primary = isVersion(p.primary) ? p.primary : "WEB";
    const compare = Array.isArray(p.compare) ? p.compare.filter((c: unknown) => isVersion(c) && c !== primary).slice(0, 2) : [];
    return { primary, compare, greek: p.greek === true };
  } catch {
    return DEFAULT_PREFS;
  }
}
