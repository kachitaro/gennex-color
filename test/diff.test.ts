import { expect, test } from "bun:test";
import { unifiedDiff } from "../src/diff";

test("unified diff: only changed lines with context, no output when equal", () => {
  expect(unifiedDiff("a\nb\n", "a\nb\n")).toBe("");
  const old = Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n") + "\n";
  const neu = old.replace("l10\n", "l10x\nnew\n").replace("l2\n", "");
  const d = unifiedDiff(old, neu, "src/x.css");
  expect(d).toContain("--- src/x.css\n+++ src/x.css\n");
  expect(d).toContain("-l2\n");
  expect(d).toContain("-l10\n+l10x\n+new\n");
  expect(d).not.toContain("l15");
  expect(d.match(/^@@/gm)!.length).toBe(2);
});
