import { describe, expect, it } from "vitest";
import { parseWordProjectChapter } from "./wordproject";

const page = (inner: string) =>
  `<div class="textBody" id="textBody">\n<h3>ምዕራፍ 2 </h3>\n<!--... the Word of God:--><span class="dimver">\n </span>\n<p>${inner}  </p>\n<!--... sharper -->\n</div> <!-- /textBody -->`;

describe("parseWordProjectChapter", () => {
  it("reads verse 1 from its commented-out marker and later verses from spans", () => {
    const v = parseWordProjectChapter(page(`<!--span class="verse" id="1">1  </span-->ኢየሱስም ተወለደ።\n<br /><span class="verse" id="2">2 </span> ንጉሡ ደነገጠ፤`));
    expect(v).toEqual([{ verse: 1, text: "ኢየሱስም ተወለደ።" }, { verse: 2, text: "ንጉሡ ደነገጠ፤" }]);
  });

  it("marks a verse printed together with the next as null", () => {
    const v = parseWordProjectChapter(page(`<!--span class="verse" id="1">1  </span-->ሀ።\n<br /><span class="verse" id="2">2 </span>-<br /><span class="verse" id="3">3 </span> ለ እና ሐ።`));
    expect(v.map((x) => x.text)).toEqual(["ሀ።", null, "ለ እና ሐ።"]);
  });
});
