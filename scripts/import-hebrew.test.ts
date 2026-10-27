import { describe, expect, it } from "vitest";
import { parseTahotLine } from "./import-hebrew";

const line = (ref: string, rest: string) => `${ref}\t${rest}`;

describe("parseTahotLine", () => {
  it("joins prefix parts and takes the braced Strong's number as the word", () => {
    const w = parseTahotLine(line("Gen.1.1#01=L", "בְּ/רֵאשִׁ֖ית\tbe./re.Shit\tin/ beginning\tH9003/{H7225G}\tHR/Ncfsa\t\t\tH7225G"));
    expect(w).toMatchObject({ book: "Gen", chapter: 1, verse: 1, position: 1, surface: "בְּרֵאשִׁ֖ית", gloss: "in beginning", strongs: "H7225G", morph: "HR/Ncfsa" });
  });
  it("uses the English reference where the Hebrew numbering differs", () => {
    expect(parseTahotLine(line("Mal.4.1(3.19)#02=L", "הִנֵּ֤ה\thi.Neh\there!\t{H2009}\tHTj"))).toMatchObject({ chapter: 4, verse: 1 });
  });
  it("leaves out marginal readings (Qere) and headers", () => {
    expect(parseTahotLine(line("Gen.8.17#11=Q(K)", "הַיְצֵ֣א\thay.tze'\tbring out\t{H3318}\tHVhv2ms"))).toBeNull();
    expect(parseTahotLine("# Gen.1.1\tbe.re.Shit (בְּרֵאשִׁ֖ית)")).toBeNull();
  });
});
