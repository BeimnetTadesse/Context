// Shared by the reference-work fetch and import scripts.

/** ISBE article pages for each NT book (some articles span several pages or cover several books). */
export const ISBE_PAGES: Record<string, string[]> = {
  matthew: ["M/matthew-the-gospel-of"],
  mark: ["M/mark-the-gospel-according-to-1", "M/mark-the-gospel-according-to-2"],
  luke: ["L/luke-the-gospel-of"],
  john: ["J/john-gospel-of"],
  acts: ["A/acts-of-the-apostles-1-7", "A/acts-of-the-apostles-8-12", "A/acts-of-the-apostles-13-outline"],
  romans: ["R/romans-epistle-to-the"],
  "1-corinthians": ["C/corinthians-first-epistle-to-the"],
  "2-corinthians": ["C/corinthians-second-epistle-to-the"],
  galatians: ["G/galatians-epistle-to-the"],
  ephesians: ["E/ephesians-epistle-to-the"],
  philippians: ["P/philippians-the-epistle-to-the"],
  colossians: ["C/colossians-epistle-to-the"],
  "1-thessalonians": ["T/thessalonians-the-first-epistle-of-paul-to-the"],
  "2-thessalonians": ["T/thessalonians-the-second-epistle-of-paul-to-the"],
  "1-timothy": ["P/pastoral-epistles"], // ISBE's Timothy entry is only "See PASTORAL EPISTLES"
  "2-timothy": ["P/pastoral-epistles"],
  titus: ["T/titus-epistle-to", "P/pastoral-epistles"],
  philemon: ["P/philemon-epistle-to"],
  hebrews: ["H/hebrews-epistle-to-the"],
  james: ["J/james-epistle-of"],
  "1-peter": ["P/peter-the-first-epistle-of"],
  "2-peter": ["P/peter-the-second-epistle-of"],
  "1-john": ["J/john-the-epistles-of-part-1-3", "J/john-the-epistles-of-part-4-9"],
  "2-john": ["J/john-the-epistles-of-part-1-3", "J/john-the-epistles-of-part-4-9"],
  "3-john": ["J/john-the-epistles-of-part-1-3", "J/john-the-epistles-of-part-4-9"],
  jude: ["J/jude-the-epistle-of"],
  revelation: ["R/revelation-of-john"], // (ISBE's "Revelation, 1-2 / 3-4" is the doctrine of revelation, not the book)
};
