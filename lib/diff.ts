// Word-level comparison between two translations of the same verse.
// Returns, for each token of `b`, whether it also appears (in order) in `a` — via a longest common subsequence,
// so re-ordered or substituted words are the ones highlighted.
const normalize = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "").replace(/'/g, "");

export function sharedWords(a: string, b: string): { token: string; shared: boolean }[] {
  const parts = b.split(/(\s+)/);
  const bWords = parts.map((p, i) => ({ i, n: normalize(p) })).filter((x) => x.n);
  const aWords = a.split(/\s+/).map(normalize).filter(Boolean);
  const m = aWords.length, n = bWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = aWords[i] === bWords[j].n ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const shared = new Set<number>();
  for (let i = 0, j = 0; i < m && j < n; ) {
    if (aWords[i] === bWords[j].n) {
      shared.add(bWords[j].i);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return parts.map((token, i) => ({ token, shared: !normalize(token) || shared.has(i) }));
}
