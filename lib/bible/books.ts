// The 66-book canon with every id scheme our data sources use.
// osis: OpenBible + our URLs' canonical ref · step: STEP TAGNT · usfm: eBible files.
// Study features are NT-only; OT text exists so Connections can show OT background verses.

export type Testament = "OT" | "NT";

export interface Book {
  id: number; // canon order, 1 = Genesis
  osis: string;
  step: string;
  usfm: string;
  name: string;
  slug: string;
  testament: Testament;
  chapters: number;
  aliases: string[]; // extra spellings accepted by the reference parser
}

const raw: [osis: string, step: string, usfm: string, name: string, aliases: string][] = [
  ["Gen", "Gen", "GEN", "Genesis", "ge gn"],
  ["Exod", "Exo", "EXO", "Exodus", "ex exo"],
  ["Lev", "Lev", "LEV", "Leviticus", "le lv"],
  ["Num", "Num", "NUM", "Numbers", "nu nm nb"],
  ["Deut", "Deu", "DEU", "Deuteronomy", "dt de deu"],
  ["Josh", "Jos", "JOS", "Joshua", "jos jsh"],
  ["Judg", "Jdg", "JDG", "Judges", "jdg jg"],
  ["Ruth", "Rut", "RUT", "Ruth", "ru rth"],
  ["1Sam", "1Sa", "1SA", "1 Samuel", "1sa 1s"],
  ["2Sam", "2Sa", "2SA", "2 Samuel", "2sa 2s"],
  ["1Kgs", "1Ki", "1KI", "1 Kings", "1ki 1k 1kin 1kg"],
  ["2Kgs", "2Ki", "2KI", "2 Kings", "2ki 2k 2kin 2kg"],
  ["1Chr", "1Ch", "1CH", "1 Chronicles", "1ch"],
  ["2Chr", "2Ch", "2CH", "2 Chronicles", "2ch"],
  ["Ezra", "Ezr", "EZR", "Ezra", "ezr"],
  ["Neh", "Neh", "NEH", "Nehemiah", "ne"],
  ["Esth", "Est", "EST", "Esther", "es est"],
  ["Job", "Job", "JOB", "Job", "jb"],
  ["Ps", "Psa", "PSA", "Psalms", "psalm psa pss"],
  ["Prov", "Pro", "PRO", "Proverbs", "pr prv"],
  ["Eccl", "Ecc", "ECC", "Ecclesiastes", "ec qoh"],
  ["Song", "Sng", "SNG", "Song of Songs", "song of solomon sos ss sol"],
  ["Isa", "Isa", "ISA", "Isaiah", "is"],
  ["Jer", "Jer", "JER", "Jeremiah", "je jr"],
  ["Lam", "Lam", "LAM", "Lamentations", "la"],
  ["Ezek", "Ezk", "EZK", "Ezekiel", "eze ezk"],
  ["Dan", "Dan", "DAN", "Daniel", "da dn"],
  ["Hos", "Hos", "HOS", "Hosea", "ho"],
  ["Joel", "Jol", "JOL", "Joel", "jl joe"],
  ["Amos", "Amo", "AMO", "Amos", "am amo"],
  ["Obad", "Oba", "OBA", "Obadiah", "ob"],
  ["Jonah", "Jon", "JON", "Jonah", "jnh"],
  ["Mic", "Mic", "MIC", "Micah", "mi"],
  ["Nah", "Nam", "NAM", "Nahum", "na"],
  ["Hab", "Hab", "HAB", "Habakkuk", "hb"],
  ["Zeph", "Zep", "ZEP", "Zephaniah", "zep zp"],
  ["Hag", "Hag", "HAG", "Haggai", "hg"],
  ["Zech", "Zec", "ZEC", "Zechariah", "zec zc zac"],
  ["Mal", "Mal", "MAL", "Malachi", "ml"],
  ["Matt", "Mat", "MAT", "Matthew", "mt mat"],
  ["Mark", "Mrk", "MRK", "Mark", "mk mr mrk mar"],
  ["Luke", "Luk", "LUK", "Luke", "lk lu luk"],
  ["John", "Jhn", "JHN", "John", "jn jhn joh"],
  ["Acts", "Act", "ACT", "Acts", "ac act"],
  ["Rom", "Rom", "ROM", "Romans", "ro rm"],
  ["1Cor", "1Co", "1CO", "1 Corinthians", "1co"],
  ["2Cor", "2Co", "2CO", "2 Corinthians", "2co"],
  ["Gal", "Gal", "GAL", "Galatians", "ga"],
  ["Eph", "Eph", "EPH", "Ephesians", "ephes"],
  ["Phil", "Php", "PHP", "Philippians", "php pp phi"],
  ["Col", "Col", "COL", "Colossians", "co"],
  ["1Thess", "1Th", "1TH", "1 Thessalonians", "1th 1thes"],
  ["2Thess", "2Th", "2TH", "2 Thessalonians", "2th 2thes"],
  ["1Tim", "1Ti", "1TI", "1 Timothy", "1ti 1tm"],
  ["2Tim", "2Ti", "2TI", "2 Timothy", "2ti 2tm"],
  ["Titus", "Tit", "TIT", "Titus", "tit ti"],
  ["Phlm", "Phm", "PHM", "Philemon", "phm phlm pm plm"],
  ["Heb", "Heb", "HEB", "Hebrews", "he"],
  ["Jas", "Jas", "JAS", "James", "jm ja jam"],
  ["1Pet", "1Pe", "1PE", "1 Peter", "1pe 1pt 1p"],
  ["2Pet", "2Pe", "2PE", "2 Peter", "2pe 2pt 2p"],
  ["1John", "1Jn", "1JN", "1 John", "1jn 1jo 1j"],
  ["2John", "2Jn", "2JN", "2 John", "2jn 2jo 2j"],
  ["3John", "3Jn", "3JN", "3 John", "3jn 3jo 3j"],
  ["Jude", "Jud", "JUD", "Jude", "jud jd jde"],
  ["Rev", "Rev", "REV", "Revelation", "re rv apocalypse revelations"],
];

// Chapters per book, in canon order (English Bible numbering).
const CHAPTERS = "50 40 27 36 34 24 21 4 31 24 22 25 29 36 10 13 10 42 150 31 12 8 66 52 5 48 12 14 3 9 1 4 7 3 3 3 2 14 4 28 16 24 21 28 16 16 13 6 6 4 4 5 3 6 4 3 1 13 5 5 3 5 1 1 1 22"
  .split(" ")
  .map(Number);

export const BOOKS: Book[] = raw.map(([osis, step, usfm, name, aliases], i) => ({
  id: i + 1,
  osis,
  step,
  usfm,
  name,
  slug: name.toLowerCase().replace(/ /g, "-"),
  testament: i < 39 ? "OT" : "NT",
  chapters: CHAPTERS[i],
  aliases: aliases.split(" "),
}));

export const NT_BOOKS = BOOKS.filter((b) => b.testament === "NT");

export const bookBySlug = (slug: string) => BOOKS.find((b) => b.slug === slug);

/**
 * A New Testament chapter from untrusted input (URL params, request bodies), or null.
 * The chapter must exist: "John 99" is rejected before it reaches the database, an AI call or a provider.
 */
export function ntChapter(slug: unknown, chapter: unknown) {
  const book = typeof slug === "string" ? bookBySlug(slug) : undefined;
  const ch = Number(chapter);
  if (!book || book.testament !== "NT" || !Number.isInteger(ch) || ch < 1 || ch > book.chapters) return null;
  return { book, chapter: ch };
}
export const bookByOsis = (osis: string) => BOOKS.find((b) => b.osis === osis);
export const bookByStep = (step: string) => BOOKS.find((b) => b.step === step);
export const bookByUsfm = (usfm: string) => BOOKS.find((b) => b.usfm === usfm);
