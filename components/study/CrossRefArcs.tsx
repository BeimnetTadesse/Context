"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Arc, ChapterArcs } from "@/lib/data/arcs";
import { useStudy } from "./context";

// Cross-references as arcs (after Chris Harrison's "Bible cross-references"): the Bible as a line of chapters,
// bars sized by verse count, and an arc from this chapter to every place it is linked to. Old Testament arcs and
// New Testament arcs have their own colour; stronger links (more reader votes on OpenBible.info) are darker.

const W = 1000;
const OT = "var(--l-historical)";
const NT = "var(--l-inference)";
// Book groups along the line, by book index (Genesis = 0).
const GROUPS: [string, number, number][] = [
  ["Law", 0, 4], ["History", 5, 16], ["Wisdom", 17, 21], ["Prophets", 22, 38],
  ["Gospels · Acts", 39, 43], ["Letters", 44, 64], ["Rev", 65, 65],
];

type Target = { to: number; votes: number; refs: Arc[]; ot: boolean };

function useArcs() {
  const { book, chapter } = useStudy();
  const key = `${book.slug}/${chapter}`;
  const [data, setData] = useState<{ key: string; arcs: ChapterArcs | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/arcs/${key}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setData({ key, arcs: d }))
      .catch(() => live && setData({ key, arcs: null }));
    return () => { live = false; };
  }, [key]);
  return data?.key === key ? data.arcs : undefined;
}

/** Arcs grouped by the chapter they land in (one arc per target chapter), optionally from one verse only. */
function targetsOf(data: ChapterArcs, verse: number | null): Target[] {
  const ntStart = data.books.find((b) => b.testament === "NT")!.offset;
  const map = new Map<number, Target>();
  for (const a of data.arcs) {
    if (a.to === data.here || (verse !== null && a.from !== verse)) continue;
    const t = map.get(a.to) ?? { to: a.to, votes: 0, refs: [], ot: a.to < ntStart };
    t.votes += a.votes;
    t.refs.push(a);
    map.set(a.to, t);
  }
  return [...map.values()].sort((a, b) => a.votes - b.votes); // strongest drawn last, on top
}

function ArcSvg({ data, targets, height, detailed, hovered, onHover, onPick }: {
  data: ChapterArcs; targets: Target[]; height: number; detailed: boolean;
  hovered?: number | null; onHover?: (to: number | null) => void; onPick?: (t: Target) => void;
}) {
  const base = height - (detailed ? 70 : 34);
  const pad = 10;
  const x = (i: number) => pad + ((i + 0.5) / data.total) * (W - 2 * pad);
  const maxVerses = Math.max(...data.verseCounts);
  const maxVotes = Math.max(1, ...targets.map((t) => t.votes));
  const ntStart = data.books.find((b) => b.testament === "NT")!.offset;
  const x0 = x(data.here);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img"
      aria-label={`Cross-references from this chapter to ${targets.length} chapters across the Bible`}>
      {/* the chapters, as bars under the line */}
      {data.verseCounts.map((n, i) => (
        <rect key={i} x={x(i) - 0.35} y={base + 3} width={0.7} height={3 + (n / maxVerses) * (detailed ? 26 : 18)}
          fill={i === data.here ? "var(--accent)" : i < ntStart ? "var(--muted)" : "var(--ink-2)"} opacity={i === data.here ? 1 : 0.35} />
      ))}
      <line x1={pad} x2={W - pad} y1={base + 1} y2={base + 1} stroke="var(--rule)" strokeWidth={1} />
      {/* the arcs */}
      {targets.map((t) => {
        const x1 = x(t.to);
        const rx = Math.abs(x1 - x0) / 2;
        const ry = Math.min(rx, base - 8);
        const strength = Math.log1p(t.votes) / Math.log1p(maxVotes);
        const active = hovered === t.to;
        const d = `M ${x0} ${base} A ${rx} ${ry} 0 0 ${x1 > x0 ? 1 : 0} ${x1} ${base}`;
        return (
          <g key={t.to}>
            <path d={d} fill="none" stroke={t.ot ? OT : NT} strokeWidth={active ? 2.6 : detailed ? 1.1 : 0.9}
              opacity={hovered != null && !active ? 0.08 : active ? 1 : 0.14 + 0.7 * strength} />
            {detailed && (
              <path d={d} fill="none" stroke="transparent" strokeWidth={9} className="cursor-pointer"
                onMouseEnter={() => onHover?.(t.to)} onMouseLeave={() => onHover?.(null)} onClick={() => onPick?.(t)}>
                <title>{t.refs.slice(0, 3).map((r) => r.ref).join(", ")}</title>
              </path>
            )}
          </g>
        );
      })}
      {/* this chapter */}
      <circle cx={x0} cy={base} r={detailed ? 4 : 3.5} fill="var(--accent)" />
      {detailed && (
        <>
          <line x1={x(ntStart) - 0.5} x2={x(ntStart) - 0.5} y1={base - 4} y2={base + 34} stroke="var(--ink-2)" strokeDasharray="2 3" opacity={0.6} />
          {GROUPS.map(([name, a, b]) => {
            const from = data.books[a].offset;
            const to = data.books[b].offset + data.books[b].chapters - 1;
            return (
              <text key={name} x={(x(from) + x(to)) / 2} y={base + 54} textAnchor="middle" fontSize={11}
                className="fill-[var(--muted)] font-mono uppercase" letterSpacing={1}>{name}</text>
            );
          })}
          <text x={x(ntStart / 2)} y={height - 2} textAnchor="middle" fontSize={11} className="fill-[var(--ink-2)] font-mono">OLD TESTAMENT</text>
          <text x={x(ntStart + (data.total - ntStart) / 2)} y={height - 2} textAnchor="middle" fontSize={11} className="fill-[var(--ink-2)] font-mono">NEW</text>
        </>
      )}
    </svg>
  );
}

function Summary({ targets, data, name, verse = null }: { targets: Target[]; data: ChapterArcs; name: string; verse?: number | null }) {
  const links = targets.reduce((n, t) => n + t.refs.length, 0);
  const ot = targets.filter((t) => t.ot).reduce((n, t) => n + t.refs.length, 0);
  const within = data.arcs.filter((a) => a.to === data.here && (verse === null || a.from === verse)).length;
  return (
    <p className="text-sm leading-relaxed text-ink-2">
      {name} links to <b className="font-medium text-ink">{targets.length} chapters</b> across the Bible ({links} references,
      {" "}<span style={{ color: OT }}>{Math.round((ot / Math.max(1, links)) * 100)}% Old Testament</span>)
      {within > 0 && <>, plus {within} within the chapter</>}.
    </p>
  );
}

/** Right column of Connections: a small arc diagram that opens the full view. */
export function CrossRefArcsPanel() {
  const { book, chapter } = useStudy();
  const data = useArcs();
  const [open, setOpen] = useState(false);
  const targets = useMemo(() => (data ? targetsOf(data, null) : []), [data]);
  const name = `${book.name} ${chapter}`;
  return (
    <section aria-label="Cross-references across the Bible">
      <p className="eyebrow !text-[0.62rem] text-accent">Across the Bible</p>
      <h2 className="mt-1 font-serif text-[1.6rem] leading-tight">Where {name} is echoed</h2>
      {data === undefined ? (
        <p className="mt-4 text-sm text-muted">Drawing the cross-references…</p>
      ) : !data || targets.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No cross-references for this chapter.</p>
      ) : (
        <>
          <button onClick={() => setOpen(true)} className="mt-4 block w-full rounded-2xl border border-rule bg-card p-3 text-left transition hover:border-ink"
            aria-label="Open the full cross-reference view">
            <ArcSvg data={data} targets={targets} height={300} detailed={false} />
            <span className="mt-2 flex justify-between font-mono text-[0.62rem] uppercase tracking-widest text-muted">
              <span>Old Testament</span><span>New</span>
            </span>
          </button>
          <div className="mt-3"><Summary targets={targets} data={data} name={name} /></div>
          <button onClick={() => setOpen(true)} className="mt-3 text-sm text-accent hover:underline">Open full view →</button>
          {/* Rendered at the page level: the right column is its own layer and would sit under the top bar. */}
          {open && createPortal(<FullView data={data} name={name} onClose={() => setOpen(false)} />, document.body)}
        </>
      )}
    </section>
  );
}

/** The full view: big diagram, one verse at a time if you like, hover for the reference, click to go there. */
function FullView({ data, name, onClose }: { data: ChapterArcs; name: string; onClose: () => void }) {
  const router = useRouter();
  const [verse, setVerse] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const targets = useMemo(() => targetsOf(data, verse), [data, verse]);
  const perVerse = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of data.arcs) if (a.to !== data.here) m.set(a.from, (m.get(a.from) ?? 0) + 1);
    return m;
  }, [data]);
  const verses = data.verseCounts[data.here];
  const top = [...targets].sort((a, b) => b.votes - a.votes).slice(0, 12);
  const hoveredTarget = targets.find((t) => t.to === hovered);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const go = (t: Target) => {
    const r = [...t.refs].sort((a, b) => b.votes - a.votes)[0];
    if (r.href) { onClose(); router.push(r.href); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-label={`Cross-references of ${name}`}>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="eyebrow text-accent">Across the Bible</p>
            <h2 className="mt-2 font-serif text-[clamp(2rem,4vw,3rem)] leading-tight">Where {name} is echoed</h2>
            <div className="mt-3 max-w-2xl"><Summary targets={targets} data={data} name={verse ? `${name}:${verse}` : name} verse={verse} /></div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-rule px-4 py-2 text-sm hover:border-ink" aria-label="Close">✕ Close</button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-2 !text-[0.62rem] text-muted">From verse</span>
          <button onClick={() => setVerse(null)} className={`h-8 rounded-lg border px-3 font-mono text-xs ${verse === null ? "border-ink bg-ink text-paper" : "border-rule bg-card hover:border-ink"}`}>All</button>
          {Array.from({ length: verses }, (_, i) => i + 1).map((v) => {
            const n = perVerse.get(v) ?? 0;
            return (
              <button key={v} onClick={() => setVerse(v)} disabled={n === 0} title={`${n} references`}
                className={`h-8 min-w-8 rounded-lg border px-2 font-mono text-xs ${verse === v ? "border-ink bg-ink text-paper" : n ? "border-rule bg-card hover:border-ink" : "border-rule text-muted/50"}`}>
                {v}
              </button>
            );
          })}
        </div>

        <div className="relative mt-6 rounded-3xl border border-rule bg-card p-4 sm:p-6">
          <ArcSvg data={data} targets={targets} height={460} detailed hovered={hovered} onHover={setHovered} onPick={go} />
          <div className="mt-2 flex min-h-12 flex-wrap items-center justify-between gap-3 text-sm">
            {hoveredTarget ? (
              <p>
                <span className="font-serif text-lg">{hoveredTarget.refs.slice(0, 3).map((r) => r.ref).join(", ")}{hoveredTarget.refs.length > 3 ? ` +${hoveredTarget.refs.length - 3}` : ""}</span>
                <span className="ml-3 font-mono text-xs text-muted">{hoveredTarget.votes} votes{hoveredTarget.refs[0].href ? " · click to open" : ""}</span>
              </p>
            ) : (
              <p className="text-muted">Hover an arc to see where it lands. New Testament arcs open that passage.</p>
            )}
            <p className="flex items-center gap-4 font-mono text-[0.68rem] uppercase tracking-widest text-muted">
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-5" style={{ background: OT }} />Old Testament</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-5" style={{ background: NT }} />New Testament</span>
              <span>Darker = more votes</span>
            </p>
          </div>
        </div>

        <h3 className="mt-10 font-serif text-2xl">Strongest links{verse ? ` from verse ${verse}` : ""}</h3>
        <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
          {top.map((t) => {
            const best = [...t.refs].sort((a, b) => b.votes - a.votes);
            return (
              <li key={t.to} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
                <span>
                  {best[0].href ? (
                    <Link href={best[0].href} onClick={onClose} className="font-serif text-lg hover:text-accent">{best[0].ref}</Link>
                  ) : (
                    <span className="font-serif text-lg">{best[0].ref}</span>
                  )}
                  {best.length > 1 && <span className="ml-2 text-sm text-muted">+{best.length - 1} more there</span>}
                  <span className="ml-2 font-mono text-xs text-muted">from {[...new Set(best.map((r) => r.from))].slice(0, 4).map((v) => `v${v}`).join(", ")}</span>
                </span>
                <span className="shrink-0 font-mono text-xs" style={{ color: t.ot ? OT : NT }}>{t.votes} votes</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-muted">
          Cross-references from OpenBible.info (CC BY), counting only links readers voted up. Arc diagram after Chris Harrison’s
          “Bible cross-references” visualisation.
        </p>
      </div>
    </div>
  );
}
