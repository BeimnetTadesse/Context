"use client";

import { useEffect, useId, useRef, useState } from "react";
import { VERSIONS, isEthiopic, isLicensedVersion, versionInfo, type VersionCode } from "@/lib/versions";

const GROUPS = [
  { name: "Open texts", codes: VERSIONS.filter((v) => !isLicensedVersion(v.code)).map((v) => v.code) },
  { name: "Licensed · display only", codes: VERSIONS.filter((v) => isLicensedVersion(v.code)).map((v) => v.code) },
];
const ORDER = GROUPS.flatMap((g) => g.codes);

/**
 * The main-version picker: a listbox in the page's own style (the system menu can't be styled). Keyboard: ↑ ↓ Home End
 * to move, Enter or Space to choose, Esc to close, and typing a version's first letters jumps to it.
 */
export function VersionSelect({ value, onChange, missing = [], bookName }: { value: VersionCode; onChange: (v: VersionCode) => void; missing?: VersionCode[]; bookName?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<VersionCode>(value);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const id = useId();

  const show = () => {
    setActive(value);
    setOpen(true);
  };
  const choose = (c: VersionCode) => {
    if (missing.includes(c) && c !== value) return; // this version doesn't have the book
    setOpen(false);
    if (c !== value) onChange(c);
    root.current?.querySelector("button")?.focus();
  };

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the active option in view and give the list focus while open.
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    list.current?.querySelector(`[data-code="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKey = (e: React.KeyboardEvent) => {
    const i = ORDER.indexOf(active);
    const go = (c: VersionCode) => {
      e.preventDefault();
      setActive(c);
    };
    if (e.key === "ArrowDown") return go(ORDER[Math.min(ORDER.length - 1, i + 1)]);
    if (e.key === "ArrowUp") return go(ORDER[Math.max(0, i - 1)]);
    if (e.key === "Home") return go(ORDER[0]);
    if (e.key === "End") return go(ORDER[ORDER.length - 1]);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return choose(active);
    }
    if (e.key === "Escape" || e.key === "Tab") return setOpen(false);
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = ORDER.find((c) => c.toLowerCase().startsWith(typed.current.text) || versionInfo(c).name.toLowerCase().startsWith(typed.current.text));
      if (hit) go(hit);
    }
  };

  const current = versionInfo(value);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
        className={`flex min-w-[15rem] items-center gap-2 rounded-full border bg-card py-1.5 pl-3.5 pr-3 text-left text-sm text-ink transition ${
          open ? "border-ink" : "border-rule hover:border-ink/40"
        }`}
      >
        <span className={`font-medium ${isEthiopic(value) ? "font-ethiopic" : ""}`}>{current.short}</span>
        <span className="truncate text-ink-2">{current.name}</span>
        <svg viewBox="0 0 12 12" width="11" height="11" className={`ml-auto shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>

      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label="Main version"
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onKey}
          className="absolute left-0 top-[calc(100%+6px)] z-40 max-h-[min(26rem,70vh)] w-[22rem] max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-2xl border border-rule bg-card p-1.5 shadow-[0_18px_44px_-18px_rgb(31_27_23/0.45)] focus:outline-none"
        >
          {GROUPS.map((g) => (
            <li key={g.name} role="presentation">
              <p className="eyebrow px-3 pb-1 pt-2.5 !text-[0.6rem] text-muted">{g.name}</p>
              <ul role="group" aria-label={g.name}>
                {g.codes.map((c) => {
                  const v = versionInfo(c);
                  const selected = c === value;
                  const absent = missing.includes(c);
                  return (
                    <li
                      key={c}
                      id={`${id}-${c}`}
                      data-code={c}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={absent || undefined}
                      onMouseEnter={() => setActive(c)}
                      onClick={() => choose(c)}
                      className={`flex items-start gap-3 rounded-xl px-3 py-2 ${absent ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${c === active ? "bg-paper-2" : ""}`}
                    >
                      <span className={`w-12 shrink-0 pt-px font-mono text-[0.72rem] ${selected ? "text-accent" : "text-ink-2"} ${isEthiopic(c) ? "font-ethiopic !text-[0.8rem]" : ""}`}>
                        {v.short}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug text-ink">{v.name}</span>
                        <span className="block truncate text-xs text-muted">{absent ? `Doesn’t include ${bookName}` : v.note}</span>
                      </span>
                      {selected && (
                        <svg viewBox="0 0 12 12" width="12" height="12" className="mt-1 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M2.5 6.2 5 8.5 9.5 3.5" />
                        </svg>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
