import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { collect, type Node } from "./apibible";

const t = (text: string, verseId?: string): Node => ({ type: "text", text, ...(verseId ? { attrs: { verseId } } : {}) });
const verse = (n: number): Node => ({ name: "verse", type: "tag", attrs: { number: String(n) }, items: [t(String(n))] });

describe("collect", () => {
  it("keeps poetry lines that carry no verseId (NLT Genesis 1:27)", () => {
    const content: Node[] = [
      { name: "para", type: "tag", items: [verse(26), t("Then God said…", "GEN.1.26")] },
      { name: "para", type: "tag", items: [verse(27), t("So God created human beings")] },
      { name: "para", type: "tag", items: [t(" in the image of God")] },
      { name: "para", type: "tag", items: [verse(28), t("Then God blessed them", "GEN.1.28")] },
    ];
    const out: Record<number, string> = {};
    collect(content, out);
    expect(out).toEqual({ 26: "Then God said…", 27: "So God created human beings in the image of God", 28: "Then God blessed them" });
  });
  it("does not count the printed verse number as text", () => {
    const out: Record<number, string> = {};
    collect([{ name: "para", type: "tag", items: [verse(1), t("In the beginning", "GEN.1.1")] }], out);
    expect(out[1]).toBe("In the beginning");
  });
});
