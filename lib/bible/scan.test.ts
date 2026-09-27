import { describe, expect, it } from "vitest";
import { bookByOsis } from "./books";
import { scanRefs } from "./scan";

const eph = bookByOsis("Eph")!;
const brief = (t: string) => scanRefs(t, eph).map((r) => `${r.book.osis} ${r.chapter}:${r.verseStart}-${r.chapterEnd}:${r.verseEnd}`);

describe("scanRefs", () => {
  it("reads standard references and ranges", () => {
    expect(brief("(see Acts 9:15-16; Gal 1:12)")).toEqual(["Acts 9:15-9:16", "Gal 1:12-1:12"]);
  });
  it("carries the book forward for follow-on references", () => {
    expect(brief("Rom 1:5; 11:13-14; 15:15-18")).toEqual(["Rom 1:5-1:5", "Rom 11:13-11:14", "Rom 15:15-15:18"]);
  });
  it("understands JFB's e-Sword style book names", () => {
    expect(brief("the way is to read it (Ti2 3:15-16). Compare Co1 2:7")).toEqual(["2Tim 3:15-3:16", "1Cor 2:7-2:7"]);
  });
  it("resolves bare references against the current book", () => {
    expect(brief("3:3 What Paul briefly wrote earlier is a reference to 1:9-10")).toEqual(["Eph 3:3-3:3", "Eph 1:9-1:10"]);
  });
  it("handles cross-chapter ranges and numbered books", () => {
    expect(brief("1 Cor 12:1 and 1 John 4:7-5:3")).toEqual(["1Cor 12:1-12:1", "1John 4:7-5:3"]);
  });
  it("uses a book named in the prose just before a bare reference", () => {
    expect(brief("the same day, as Isaiah (35:4) tells us")).toEqual(["Isa 35:4-35:4"]);
    expect(brief("a passage in Luke's Gospel, (17:25,) where Christ says")).toEqual(["Luke 17:25-17:25"]);
  });
  it("only carries a book forward inside a list", () => {
    expect(brief("see Rom 16:26; Col 1:6, 23. 14:22-33 Jesus’ power over nature")).toEqual([
      "Rom 16:26-16:26", "Col 1:6-1:6", "Eph 14:22-14:33",
    ]);
  });
  it("keeps the book through lists that contain bare verse numbers or 'and'", () => {
    expect(brief("(cp. Matt 8:12; 13:42, 50; 22:13; 24:51; Luke 13:28)")).toEqual([
      "Matt 8:12-8:12", "Matt 13:42-13:42", "Matt 22:13-22:13", "Matt 24:51-24:51", "Luke 13:28-13:28",
    ]);
    expect(brief("Paul quotes both Isa 8:14 and 28:16 (Rom 9:33)")).toEqual(["Isa 8:14-8:14", "Isa 28:16-28:16", "Rom 9:33-9:33"]);
  });
  it("never assigns apocryphal references to a canonical book", () => {
    expect(brief("fight if attacked (1 Maccabees 2:32-41). Also 2 Esdras 1:33")).toEqual([]);
    expect(brief("see also 1 Maccabees 2:18; 6:28). Moses (Exod 33:11)")).toEqual(["Exod 33:11-33:11"]);
  });
  it("sets aside Jewish writings outside the Bible", () => {
    expect(brief("(see Psalms of Solomon 17:26-28; 4 Ezra 11:7-8; 2 Baruch 77:19). Cp. Acts 1:6")).toEqual(["Acts 1:6-1:6"]);
  });
  it("ignores capitalised words that are not books", () => {
    expect(brief("Irenaeus 5:2 and Against Heresies 3:4")).toEqual([]);
    expect(brief("at 12:30 PM")).toEqual(["Eph 12:30-12:30"]); // bare times look like refs; the resolver rejects Eph 12
  });
});
