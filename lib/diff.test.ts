import { describe, expect, it } from "vitest";
import { sharedWords } from "./diff";

const changed = (a: string, b: string) => sharedWords(a, b).filter((t) => !t.shared).map((t) => t.token);

describe("sharedWords", () => {
  it("marks the words a second translation adds or substitutes", () => {
    expect(changed("that the Gentiles are fellow heirs", "That the Gentiles should be fellowheirs")).toEqual(["should", "be", "fellowheirs"]);
  });
  it("ignores punctuation and case", () => {
    expect(changed("For this cause, I Paul,", "for this cause I, Paul")).toEqual([]);
  });
});
