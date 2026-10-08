import { isEthiopic, isLicensedVersion, versionInfo, type ReadPrefs } from "@/lib/versions";
import { Combined, Diffed, guard, Highlight, Marked, Moved, Restored, Vn } from "./marks";
import { coveredBy, spanEnd, textOf } from "./text";
import type { ReadViewProps } from "./types";

/** Compare: one row per verse, a column per version. */
export function CompareView({ verses, prefs, licensed, licensedFailed, markFor, trail, onVerse, activeVerse, highlights }: ReadViewProps & { prefs: ReadPrefs }) {
  const cols = [prefs.primary, ...prefs.compare];
  const grid = cols.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className="divide-y divide-rule">
      <div className={`hidden gap-6 pb-3 sm:grid ${grid}`}>
        {cols.map((c, i) => (
          <p key={c} className="eyebrow text-muted">
            {versionInfo(c).name}
            {i === 0 ? " · main" : ""}
          </p>
        ))}
      </div>
      {verses.map((v) => {
        // Highlight differences only between texts in the same script, and not across combined verses.
        const base = spanEnd(v, prefs.primary, licensed) ? undefined : textOf(v, prefs.primary, licensed);
        return (
          <div key={v.ord} id={`v${v.verse}`} className={`grid scroll-mt-28 gap-3 py-4 sm:gap-6 ${grid}`}>
            {cols.map((c, i) => {
              const text = textOf(v, c, licensed);
              const pending = isLicensedVersion(c) && !licensed[c];
              const amh = c === "AMH";
              const ethiopic = isEthiopic(c);
              const end = spanEnd(v, c, licensed);
              const combined = text ? null : coveredBy(v, c, licensed, verses);
              const moved = text ? null : licensed[c]?.moved?.[v.verse];
              const diffBase = isEthiopic(prefs.primary) === ethiopic && !end ? base : undefined;
              return (
                <div key={c} {...(isLicensedVersion(c) ? { ...guard, "data-licensed": c } : {})}>
                  <p className="mb-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-muted sm:hidden">{versionInfo(c).short}</p>
                  {pending ? (
                    <p className="font-sans text-sm italic text-muted">
                      {licensedFailed.includes(c) ? `${versionInfo(c).short} is unavailable right now.` : `Loading ${versionInfo(c).short}…`}
                    </p>
                  ) : text ? (
                    <p className={ethiopic ? "ethiopic text-[1.05rem] leading-relaxed" : "font-serif text-[1.15rem] leading-relaxed"}>
                      <Vn n={v.verse} end={end} onVerse={i === 0 && !amh ? onVerse : undefined} active={activeVerse === v.verse} />
                      {amh && v.amh?.restored && <Restored />}{" "}
                      <Highlight color={highlights[v.verse]}>
                        {i === 0 ? (
                          ethiopic ? text : <Marked text={text} marks={markFor(v, c)} trail={trail} />
                        ) : (
                          <Diffed base={diffBase} text={text} />
                        )}
                      </Highlight>
                    </p>
                  ) : combined ? (
                    <p className="text-sm">
                      <Combined {...combined} />
                    </p>
                  ) : moved ? (
                    <p className="text-sm">
                      <Vn n={v.verse} /> <Moved to={moved} />
                    </p>
                  ) : amh && v.movedTo ? (
                    <p className="text-sm">
                      <Vn n={v.verse} /> <Moved to={v.movedTo} />
                    </p>
                  ) : amh ? (
                    <p className="font-sans text-sm italic text-muted">Missing from the digital copies of the Amharic text.</p>
                  ) : (
                    <p className="font-sans text-sm italic text-muted">
                      <Vn n={v.verse} /> Omitted — not in the manuscripts this version follows.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
