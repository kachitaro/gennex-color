/** Unified diff of two texts (3 lines of context). Empty string when equal. Lines keep their `\r`, so line-ending changes show. */
export function unifiedDiff(a: string, b: string, name = "file", context = 3): string {
  if (a === b) return "";
  const split = (s: string) => { const l = s.split("\n"); if (l.at(-1) === "") l.pop(); return l; };
  const A = split(a), B = split(b);
  let pre = 0;
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
  let suf = 0;
  while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
  const ma = A.slice(pre, A.length - suf), mb = B.slice(pre, B.length - suf);
  const ops: { t: " " | "-" | "+"; l: string }[] = A.slice(0, pre).map((l) => ({ t: " ", l }));
  if (ma.length * mb.length > 4_000_000) {
    ops.push(...ma.map((l) => ({ t: "-" as const, l })), ...mb.map((l) => ({ t: "+" as const, l })));
  } else {
    const dp = Array.from({ length: ma.length + 1 }, () => new Uint32Array(mb.length + 1));
    for (let i = ma.length - 1; i >= 0; i--) for (let j = mb.length - 1; j >= 0; j--) dp[i][j] = ma[i] === mb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < ma.length || j < mb.length) {
      if (i < ma.length && j < mb.length && ma[i] === mb[j]) { ops.push({ t: " ", l: ma[i] }); i++; j++; }
      else if (j >= mb.length || (i < ma.length && dp[i + 1][j] >= dp[i][j + 1])) ops.push({ t: "-", l: ma[i++] });
      else ops.push({ t: "+", l: mb[j++] });
    }
  }
  ops.push(...A.slice(A.length - suf).map((l) => ({ t: " " as const, l })));
  // group into hunks
  const changed = ops.map((o, i) => (o.t === " " ? -1 : i)).filter((i) => i >= 0);
  const hunks: [number, number][] = [];
  for (const i of changed) {
    const lo = Math.max(0, i - context), hi = Math.min(ops.length - 1, i + context);
    const last = hunks.at(-1);
    if (last && lo <= last[1] + 1) last[1] = hi; else hunks.push([lo, hi]);
  }
  let out = `--- ${name}\n+++ ${name}\n`;
  for (const [lo, hi] of hunks) {
    const before = ops.slice(0, lo), seg = ops.slice(lo, hi + 1);
    const a0 = before.filter((o) => o.t !== "+").length + 1, b0 = before.filter((o) => o.t !== "-").length + 1;
    out += `@@ -${a0},${seg.filter((o) => o.t !== "+").length} +${b0},${seg.filter((o) => o.t !== "-").length} @@\n`;
    for (const o of seg) out += `${o.t}${o.l}\n`;
  }
  return out;
}
