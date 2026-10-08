import { isEthiopic, isLicensedVersion, versionInfo, type VersionCode } from "@/lib/versions";
import { guard, Highlight, Marked, Moved, Omitted, Restored, Vn } from "./marks";
import { coveredBy, paragraphs, spanEnd, textOf } from "./text";
import type { ReadViewProps } from "./types";

/** Flowing text in one version, in the translation's own paragraphs. */
export function FlowingView({ verses, code, licensed, licensedFailed, markFor, trail, onVerse, activeVerse, highlights }: ReadViewProps & { code: VersionCode }) {
  const amh = code === "AMH";
  const ethiopic = isEthiopic(code);
  if (isLicensedVersion(code) && !licensed[code])
    return (
      <p className="font-sans italic text-muted">
        {licensedFailed.includes(code) ? `${versionInfo(code).short} is unavailable right now.` : `Loading ${versionInfo(code).short}…`}
      </p>
    );
  return (
    <div
      className={`scripture ${ethiopic ? "ethiopic" : ""}`}
      {...(isLicensedVersion(code) ? { ...guard, "data-licensed": code } : {})}
    >
      {paragraphs(verses).map((para) => (
        <p key={para[0].ord} className="mb-6">
          {para.map((v) => {
            const text = textOf(v, code, licensed);
            const combined = text ? null : coveredBy(v, code, licensed, verses);
            const moved = text ? null : licensed[code]?.moved?.[v.verse];
            if (moved)
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} /> <Moved to={moved} />{" "}
                </span>
              );
            // Already labelled on the combined verse ("5–6"): keep only an anchor for jumping to this verse.
            if (combined) return <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28" />;
            if (!amh && !text)
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} /> <Omitted />{" "}
                </span>
              );
            if (!text && v.movedTo)
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} /> <Moved to={v.movedTo} />{" "}
                </span>
              );
            if (!text)
              // Amharic: say so instead of skipping silently (every NT verse is present now, but stay honest).
              return (
                <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                  <Vn n={v.verse} />{" "}
                  <span className="font-sans text-[0.8rem] italic text-muted">[missing from the digital copies]</span>{" "}
                </span>
              );
            return (
              <span key={v.ord} id={`v${v.verse}`} className="scroll-mt-28">
                <Vn n={v.verse} end={spanEnd(v, code, licensed)} onVerse={amh ? undefined : onVerse} active={activeVerse === v.verse} />
                {amh && v.amh?.restored && <Restored />}
                <Highlight color={highlights[v.verse]}>{ethiopic ? text : <Marked text={text} marks={markFor(v, code)} trail={trail} />}</Highlight>{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
