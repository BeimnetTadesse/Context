"use client";

import { VERSIONS, versionInfo, type ReadPrefs, type VersionCode } from "@/lib/versions";

/** Choose the main version, up to two to compare, or the Greek interlinear. */
export function VersionToolbar({ prefs, onChange }: { prefs: ReadPrefs; onChange: (p: ReadPrefs) => void }) {
  const toggleCompare = (c: VersionCode) => {
    const has = prefs.compare.includes(c);
    const compare = has ? prefs.compare.filter((x) => x !== c) : [...prefs.compare, c].slice(-2);
    onChange({ ...prefs, compare, greek: false });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Version
          <select
            value={prefs.primary}
            onChange={(e) => {
              const primary = e.target.value as VersionCode;
              onChange({ primary, compare: prefs.compare.filter((c) => c !== primary), greek: false });
            }}
            className={`rounded-full border border-rule bg-card px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none ${prefs.primary === "AMH" ? "font-ethiopic" : ""}`}
          >
            {VERSIONS.map((v) => (
              <option key={v.code} value={v.code}>
                {v.short === v.code ? `${v.code} — ${v.name}` : `${v.short} — ${v.name}`}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => onChange({ ...prefs, greek: !prefs.greek, compare: prefs.greek ? prefs.compare : [] })}
          aria-pressed={prefs.greek}
          className={`rounded-full border px-3.5 py-1.5 text-sm ${prefs.greek ? "border-ink bg-ink text-paper" : "border-rule bg-card text-ink-2 hover:border-ink"}`}
        >
          Greek interlinear
        </button>
        <span className="hidden text-xs text-muted md:inline">{versionInfo(prefs.primary).note}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Compare with">
        <span className="mr-1 text-sm text-muted">Compare</span>
        {VERSIONS.filter((v) => v.code !== prefs.primary).map((v) => {
          const on = prefs.compare.includes(v.code);
          return (
            <button
              key={v.code}
              onClick={() => toggleCompare(v.code)}
              aria-pressed={on}
              title={`${v.name} — ${v.note}`}
              className={`rounded-full border px-3 py-1 text-sm ${v.code === "AMH" ? "font-ethiopic" : ""} ${
                on ? "border-[var(--l-scholarly)] bg-[var(--l-scholarly-bg)] text-ink" : "border-rule bg-card text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {on ? "✓ " : "+ "}
              {v.short}
            </button>
          );
        })}
        {prefs.compare.length > 0 && (
          <span className="ml-2 text-xs text-muted">
            <span className="rounded-sm bg-[var(--l-scholarly-bg)] px-1 text-ink">highlighted</span> = worded differently from {versionInfo(prefs.primary).short}
          </span>
        )}
      </div>
    </div>
  );
}
