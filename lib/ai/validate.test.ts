import { describe, expect, it } from "vitest";
import { checkClaim, soundsAuthoritative, stripIds, type ValidationIssue } from "./validate";

const pack = {
  byId: new Map<string, unknown>([
    ["V:Eph.3.6", {}],
    ["V:Eph.3.14", {}],
    ["L:G4954", {}],
    ["X:9", {}],
  ]),
  verseText: new Map([
    [100, "that the Gentiles are fellow heirs and fellow members of the body, and fellow partakers of his promise"],
    [108, "For this cause, I bow my knees to the Father of our Lord Jesus Christ,"],
  ]),
  ordById: new Map([
    ["V:Eph.3.6", 100],
    ["V:Eph.3.14", 108],
  ]),
};

const run = (d: Parameters<typeof checkClaim>[0]) => {
  const issues: ValidationIssue[] = [];
  return { out: checkClaim(d, pack, issues), issues };
};

describe("checkClaim", () => {
  it("keeps a well-supported explicit claim with its anchor and quote", () => {
    const { out, issues } = run({ label: "explicit", statement: "Gentiles are fellow heirs.", cites: ["V:Eph.3.6"], quote: "fellow heirs" });
    expect(issues).toEqual([]);
    expect(out?.anchors).toEqual([{ ord: 100, quote: "fellow heirs" }]);
  });

  it("drops a claim whose only citation was invented", () => {
    const { out, issues } = run({ label: "scholarly", statement: "Lincoln argues X.", cites: ["S:Lincoln1990"] });
    expect(out).toBeNull();
    expect(issues.map((i) => i.problem)).toContain("dropped: no valid citation");
  });

  it("removes invented citations but keeps the claim if real ones remain", () => {
    const { out } = run({ label: "inference", statement: "…", cites: ["V:Eph.3.6", "V:Eph.9.99"] });
    expect(out?.cites).toEqual(["V:Eph.3.6"]);
  });

  it("downgrades 'explicit' with no verse citation", () => {
    const { out } = run({ label: "explicit", statement: "…", cites: ["X:9"] });
    expect(out?.label).toBe("inference");
  });

  it("drops 'historical' claims that have no lexical evidence", () => {
    expect(run({ label: "historical", statement: "The earliest copies omit 'in Ephesus'.", cites: ["V:Eph.3.6"] }).out).toBeNull();
    expect(run({ label: "historical", statement: "σύσσωμος is rare.", cites: ["L:G4954"] }).out?.label).toBe("historical");
  });

  it("removes a quote that is not in the cited verse", () => {
    const { out, issues } = run({ label: "explicit", statement: "…", cites: ["V:Eph.3.14"], quote: "fellow heirs" });
    expect(out?.quote).toBeNull();
    expect(issues[0].problem).toMatch(/quote not found/);
  });

  it("matches quotes regardless of curly quotes and spacing", () => {
    const { out } = run({ label: "explicit", statement: "…", cites: ["V:Eph.3.14"], quote: "I  bow my knees" });
    expect(out?.anchors[0].quote).toBe("I  bow my knees");
  });
});

describe("soundsAuthoritative", () => {
  it("flags language that speaks for God", () => {
    expect(soundsAuthoritative("God is telling you to forgive.")).toBe(true);
    expect(soundsAuthoritative("The passage explicitly says Gentiles are fellow heirs.")).toBe(false);
  });
});

describe("stripIds", () => {
  it("removes evidence ids the model echoed into prose", () => {
    expect(stripIds('Paul is "the prisoner of Christ Jesus" (V:Eph.3.1).')).toBe('Paul is "the prisoner of Christ Jesus".');
    expect(stripIds("It is tied to his ministry (V:Eph.3.1, V:Eph.3.7, L:G3466).")).toBe("It is tied to his ministry.");
    expect(stripIds("No ids here (3:1).")).toBe("No ids here (3:1).");
  });
});
