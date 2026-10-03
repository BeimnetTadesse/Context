// Versions a reader can choose. Public-domain English texts and the 1962 Amharic are stored locally;
// NIV / NLT / NASB (API.Bible) and NASV / AMP / TPT (YouVersion) are licensed: fetched live, display-only, never sent to AI.
export const VERSIONS = [
  { code: "WEB", short: "WEB", name: "World English Bible", note: "Modern, readable; Majority Text" },
  { code: "BSB", short: "BSB", name: "Berean Standard Bible", note: "Modern, precise; critical text" },
  { code: "KJV", short: "KJV", name: "King James Version", note: "1611/1769; Textus Receptus" },
  { code: "ASV", short: "ASV", name: "American Standard Version", note: "1901; very literal" },
  { code: "YLT", short: "YLT", name: "Young's Literal Translation", note: "1862; word-for-word" },
  { code: "AMH", short: "አማርኛ", name: "Amharic Bible (1954 E.C. / 1962)", note: "Haile Selassie translation · complete NT (◦ = verse restored from WordProject)" },
  { code: "NASV", short: "NASV", name: "New Amharic Standard Version (2024)", note: "© Biblica · modern Amharic, complete NT", licensed: true },
  { code: "NIV", short: "NIV", name: "New International Version", note: "© Biblica · balanced, widely read", licensed: true },
  { code: "NLT", short: "NLT", name: "New Living Translation", note: "© Tyndale House · thought-for-thought", licensed: true },
  { code: "NASB", short: "NASB", name: "New American Standard Bible 2020", note: "© Lockman Foundation · word-for-word", licensed: true },
  { code: "AMP", short: "AMP", name: "Amplified Bible", note: "© Lockman Foundation · expanded: [brackets] add shades of meaning", licensed: true },
  { code: "TPT", short: "TPT", name: "The Passion Translation", note: "© Passion & Fire Ministries · paraphrase; 2020 NT, under publisher review", licensed: true },
] as const;

export const LICENSED_CODES = ["NIV", "NLT", "NASB", "NASV", "AMP", "TPT"] as const;
export const isLicensedVersion = (c: string) => (LICENSED_CODES as readonly string[]).includes(c);
/** Licensed through the YouVersion Platform (the rest come from API.Bible). */
export const isYouVersion = (c: string) => c === "NASV" || c === "AMP" || c === "TPT";
/** Written in Ge'ez script: Ethiopic font, and only compared word-for-word with each other. */
export const isEthiopic = (c: string) => c === "AMH" || c === "NASV";

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
