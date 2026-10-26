import { describe, expect, it } from "vitest";
import { restatesVerse } from "./validate";

const JOHN_3_1 = "Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews.";

describe("restatesVerse", () => {
  it("catches a note that only repeats its verse", () => {
    expect(restatesVerse("Nicodemus is identified as a Pharisee and a ruler of the Jews.", JOHN_3_1)).toBe(true);
  });
  it("lets through a note that points at something the verse doesn't say", () => {
    expect(
      restatesVerse("He comes at night, and John returns to night and light at 3:19–21, so the timing may carry meaning.", JOHN_3_1),
    ).toBe(false);
  });
  it("ignores very short notes", () => {
    expect(restatesVerse("A ruler.", JOHN_3_1)).toBe(false);
  });
});
