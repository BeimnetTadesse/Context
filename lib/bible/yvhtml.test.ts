import { describe, expect, it } from "vitest";
import { parsePassageHtml } from "./yvhtml";

const v = (n: number, ev?: number) =>
  `<span class="yv-v"${ev ? ` ev="${ev}"` : ""} v="${n}"></span><span class="yv-vlbl">${ev ? `${n}-${ev}` : n}</span>`;

describe("parsePassageHtml", () => {
  it("splits verses and drops the number labels", () => {
    const r = parsePassageHtml(`<div><div class="p">${v(1)}አንድ። ${v(2)}ሁለት።</div></div>`);
    expect(r.verses).toEqual({ 1: "አንድ።", 2: "ሁለት።" });
  });

  it("joins a verse that runs across paragraph and poetry lines", () => {
    const r = parsePassageHtml(`<div class="q1">${v(3)} <span class="wj">“ብፁዓን ናቸው፤</span></div><div class="q2"><span class="wj">የእነርሱ ናትና።</span></div>`);
    expect(r.verses[3]).toBe("“ብፁዓን ናቸው፤ የእነርሱ ናትና።");
  });

  it("records combined verses and moves a disputed verse's opening bracket onto it", () => {
    const r = parsePassageHtml(`<div class="p">${v(23)}ሰላምታ። [${v(24)}ጸጋ። አሜን።]</div><div class="p">${v(25, 26)}ሊያጸናችሁ ${v(27)}ክብር ይሁን!</div>`);
    expect(r.verses[23]).toBe("ሰላምታ።");
    expect(r.verses[24]).toBe("[ጸጋ። አሜን።]");
    expect(r.spans).toEqual({ 25: 26 });
    expect(r.verses[26]).toBeUndefined();
  });

  it("decodes entities", () => {
    expect(parsePassageHtml(`<div>${v(1)}a &amp; b</div>`).verses[1]).toBe("a & b");
  });
});
