// Versions a reader can choose. Public-domain English texts and the 1962 Amharic are stored locally;
// NIV / NLT / NASB are licensed via API.Bible: fetched live, display-only, never sent to AI.
export const VERSIONS = [
  { code: "WEB", short: "WEB", name: "World English Bible", note: "Modern, readable; Majority Text" },
  { code: "BSB", short: "BSB", name: "Berean Standard Bible", note: "Modern, precise; critical text" },
  { code: "KJV", short: "KJV", name: "King James Version", note: "1611/1769; Textus Receptus" },
  { code: "ASV", short: "ASV", name: "American Standard Version", note: "1901; very literal" },
  { code: "YLT", short: "YLT", name: "Young's Literal Translation", note: "1862; word-for-word" },
  { code: "AMH", short: "አማርኛ", name: "Amharic Bible (1954 E.C. / 1962)", note: "Haile Selassie translation · eBible e-text: ~7% of NT verses missing" },
  { code: "NIV", short: "NIV", name: "New International Version", note: "© Biblica · balanced, widely read", licensed: true },
  { code: "NLT", short: "NLT", name: "New Living Translation", note: "© Tyndale House · thought-for-thought", licensed: true },
  { code: "NASB", short: "NASB", name: "New American Standard Bible 2020", note: "© Lockman Foundation · word-for-word", licensed: true },
] as const;

export const LICENSED_CODES = ["NIV", "NLT", "NASB"] as const;
export const isLicensedVersion = (c: string) => (LICENSED_CODES as readonly string[]).includes(c);

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
