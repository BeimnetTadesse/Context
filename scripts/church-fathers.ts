// Which Church Fathers quotes Context shows, and how each one was translated.
//
// Source: the HistoricalChristianFaith Commentaries-Database (public-domain dedication), which files quotes from
// the Fathers by Bible verse. It mixes three kinds of English text, and Context keeps only the first:
//   1. Old public-domain translations: Aquinas's Catena Aurea (Oxford, 1841–45), the Ante-Nicene Fathers
//      (1885–96) and Nicene and Post-Nicene Fathers (1886–1900), and a few other 19th-century translations.
//   2. New translations made with AI (ChatGPT etc.) or by a volunteer from Migne's Latin. Their files say so, and
//      Context leaves them out: a Father's words should not be a machine's paraphrase.
//   3. Excerpts from modern, copyrighted translations (included there under fair use). Left out: these have no
//      source link, or link to Google Books / archive.org, or are works with no 19th-century English translation.

/** The patristic era: up to John of Damascus (d. 749). Later writers are medieval. */
export const LAST_YEAR = 750;

/** Not Church Fathers: Scripture itself, Second Temple Jewish writers, apocryphal acts and gospels. */
export const EXCLUDED_CATEGORIES = ["Canonical Scriptures", "Second Temple Judaism", "Apocrypha, Pseudepigrapha & Early Documents"];

/** A source file's own note that it was translated by AI or freshly from Migne's Latin. */
const TOOL = String.raw`(?:ChatGPT|GPT-?\d|\bDeepL\b|Google Translate|\bClaude\b|\bGemini\b|machine|\bAI\b|artificial intelligence|LLM)`;
export const MACHINE_NOTE = new RegExp(
  `${TOOL}[^.<]{0,80}translat|translat[^.<]{0,80}${TOOL}|Translated (?:into English )?from (?:the OCR-corrected )?Migne|Latin Text from public domain Migne|Litteral`,
  "i",
);

/**
 * Works whose English isn't one of the old public-domain translations, though their files carry no AI note:
 * modern translations (Origen's homilies, Jerome's commentaries, Gregory's Gospel homilies …) and texts we
 * couldn't trace to a 19th-century edition. Matched against the source file path.
 */
export const EXCLUDED_WORKS: RegExp[] = [
  /^Augustine of Hippo\/Sermons\//, // a fresh translation of the Latin sermons (NPNF's selection is "Sermons on Selected Lessons")
  /^Origen of Alexandria\/(Homilies on|Commentary on (Romans|Ephesians|1 Corinthians)|Dialogue with Heraclides|Treatise on the Passover|On Prayer)/,
  /^Origen of Alexandria\/Commentary on Matthew\/(Commentariorum Series|Introduction)/, // ANF has Books 1, 2, 10–14 only
  /^Origen of Alexandria\/Commentary on John\/Book (?!(1|2|4|5|6|10)\.html)/, // ANF has Books 1, 2, 4, 5, 6, 10
  /^Jerome\/(Commentary on|Homilies)/,
  /^Gregory the Dialogist\/(40 Homilies on the Gospels|Homilies on Ezekiel|Dialogues)/,
  /^Ambrosiaster\//,
  /^Oecumenius\//,
  /^Bede\//,
  /^Chromatius of Aquileia\//,
  /^Cyril of Alexandria\/Commentary on the Twelve Minor Prophets/,
  /^Irenaeus\/The Proof of the Apostolic Preaching/,
  /^Hippolytus of Rome\/Quotes on Revelation/,
  /^Martyrdom of Colluthus\//,
  /^Odes of Solomon\//,
  /\.pdf$/,
];

/** Quotes linked straight to these old-translation sites (not to HistoricalChristian.Faith) are kept too. */
export const TRUSTED_LINKS = [/^https?:\/\/(www\.)?newadvent\.org\/fathers\//, /^https?:\/\/(www\.)?ccel\.org\/(ccel\/schaff|fathers2)\//];

const ANF = "Ante-Nicene Fathers, ed. A. Roberts & J. Donaldson (1885–96)";
const NPNF = "Nicene and Post-Nicene Fathers, ed. P. Schaff & H. Wace (1886–1900)";
export const CATENA = "Catena Aurea, tr. J. H. Newman et al. (Oxford, 1841–45)";

/** Works translated outside the two big series. */
const OTHER_TRANSLATIONS: [RegExp, string][] = [
  [/^Cyril of Alexandria\/Commentary on the Gospel of John/, "tr. P. E. Pusey & T. Randell (1874–85)"],
  [/^Cyril of Alexandria\/Commentary on the Gospel of Luke/, "tr. R. Payne Smith (1859)"],
  [/^Philoxenus of Mabbug\//, "tr. E. A. Wallis Budge (1894)"],
  [/^Cosmas Indicopleustes\//, "tr. J. W. McCrindle (1897)"],
  [/^Gregory the Dialogist\/Morals on the Book of Job/, "Library of the Fathers (Oxford, 1844–50)"],
  [/^Pseudo-Dionysius the Areopagite\//, "tr. J. Parker (1897–99)"],
];

/** Which translation a kept quote comes from. `file` is the source path, e.g. "Tertullian/On Baptism.html". */
export function translationOf(file: string, category: string): string {
  if (file.startsWith("Thomas Aquinas/Catena Aurea/")) return CATENA;
  for (const [re, label] of OTHER_TRANSLATIONS) if (re.test(file)) return label;
  return category === "Early Fathers (Pre-Nicaea)" || /^(Apostolic Constitutions|Lucius Caecilius|Methodius|Shepherd of Hermas|Didache|Papias)/.test(file)
    ? ANF
    : NPNF;
}

/** Facts readers should know before weighing a voice (beyond the dataset's own "condemned by a council" flag). */
export const FATHER_NOTES: Record<string, string> = {
  "Origen of Alexandria": "Some of his teachings were condemned after his death (Constantinople, 553).",
  Tertullian: "In his later years he joined the Montanist movement.",
  "Pseudo-Chrysostom": "An unknown author whose work circulated under Chrysostom’s name.",
  "Remigius of Rheims": "The Catena’s “Remigius” is usually identified as Remigius of Auxerre (d. c. 908), a later writer.",
};

/** HistoricalChristianFaith book names → Context's book slugs ("1corinthians" → "1-corinthians"). */
export const bookSlug = (name: string) => name.replace(/^([123])/, "$1-");
