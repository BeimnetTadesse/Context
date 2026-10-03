// Every version a reader can choose: the one place to add or change a version. Everything else (licensing,
// provider, font, comparison) is derived from here.
// · local: stored in our database (public domain, or the 1962 Amharic under its non-commercial terms)
// · apibible / youversion: licensed, fetched live, display only, never stored, never sent to any AI system
type Source =
  | { kind: "local" }
  | { kind: "apibible"; bibleId: string }
  | { kind: "youversion"; bibleId: number; publisher: { name: string; url: string } };

interface VersionDef {
  code: string;
  short: string;
  name: string;
  note: string;
  /** Ge'ez script: Ethiopic font, and only compared word for word with other Ethiopic texts. */
  script?: "ethiopic";
  source: Source;
}

const BIBLICA = { name: "Biblica, Inc.", url: "https://www.biblica.com" };
const LOCKMAN = { name: "The Lockman Foundation", url: "https://www.lockman.org" };

export const VERSIONS = [
  { code: "WEB", short: "WEB", name: "World English Bible", note: "Modern, readable; Majority Text", source: { kind: "local" } },
  { code: "BSB", short: "BSB", name: "Berean Standard Bible", note: "Modern, precise; critical text", source: { kind: "local" } },
  { code: "KJV", short: "KJV", name: "King James Version", note: "1611/1769; Textus Receptus", source: { kind: "local" } },
  { code: "ASV", short: "ASV", name: "American Standard Version", note: "1901; very literal", source: { kind: "local" } },
  { code: "YLT", short: "YLT", name: "Young's Literal Translation", note: "1862; word-for-word", source: { kind: "local" } },
  { code: "AMH", short: "አማርኛ", name: "Amharic Bible (1954 E.C. / 1962)", note: "Haile Selassie translation · complete NT (◦ = verse restored from WordProject)", script: "ethiopic", source: { kind: "local" } },
  { code: "NASV", short: "NASV", name: "New Amharic Standard Version (2024)", note: "© Biblica · modern Amharic, complete NT", script: "ethiopic", source: { kind: "youversion", bibleId: 1260, publisher: BIBLICA } },
  { code: "NIV", short: "NIV", name: "New International Version", note: "© Biblica · balanced, widely read", source: { kind: "apibible", bibleId: "78a9f6124f344018-01" } },
  { code: "NLT", short: "NLT", name: "New Living Translation", note: "© Tyndale House · thought-for-thought", source: { kind: "apibible", bibleId: "d6e14a625393b4da-01" } },
  { code: "NASB", short: "NASB", name: "New American Standard Bible 2020", note: "© Lockman Foundation · word-for-word", source: { kind: "apibible", bibleId: "a761ca71e0b3ddcf-01" } },
  { code: "AMP", short: "AMP", name: "Amplified Bible", note: "© Lockman Foundation · expanded: [brackets] add shades of meaning", source: { kind: "youversion", bibleId: 1588, publisher: LOCKMAN } },
  { code: "TPT", short: "TPT", name: "The Passion Translation", note: "© Passion & Fire Ministries · paraphrase; 2020 NT, under publisher review", source: { kind: "youversion", bibleId: 1849, publisher: { name: "BroadStreet Publishing", url: "https://broadstreetpublishing.com" } } },
] as const satisfies readonly VersionDef[];

export type VersionCode = (typeof VERSIONS)[number]["code"];
export const isVersion = (c: unknown): c is VersionCode => VERSIONS.some((v) => v.code === c);
export const versionInfo = (c: VersionCode): VersionDef => VERSIONS.find((v) => v.code === c)!;

const sourceOf = (c: string): Source["kind"] => (VERSIONS as readonly VersionDef[]).find((v) => v.code === c)?.source.kind ?? "local";
/** Licensed: fetched live from a provider, display only. */
export const isLicensedVersion = (c: string) => sourceOf(c) !== "local";
/** Licensed through the YouVersion Platform (the others come from API.Bible). */
export const isYouVersion = (c: string) => sourceOf(c) === "youversion";
export const isEthiopic = (c: string) => (VERSIONS as readonly VersionDef[]).find((v) => v.code === c)?.script === "ethiopic";

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
