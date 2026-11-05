import { describe, expect, test } from "bun:test";
import { ALPHA_TEXT, AUDIT_PAIRS, CHARTS, auditTheme, pairRatio } from "../src/audit";
import { CORE_HUES } from "../src/hues";
import { buildTheme } from "../src/theme";

describe("auditTheme (the pair table, shipped from src/)", () => {
  test("every core hue passes in both primary modes; counts follow the table", () => {
    for (const { hue } of CORE_HUES) for (const primaryMode of ["accessible", "vivid"] as const) {
      const r = auditTheme(buildTheme({ hue, primaryMode }), { primaryMode });
      expect([hue, primaryMode, r.failed]).toEqual([hue, primaryMode, []]);
      expect(r.checked).toBeGreaterThanOrEqual(200);
    }
    const acc = auditTheme(buildTheme({ hue: 255 })).checked, viv = auditTheme(buildTheme({ hue: 255, primaryMode: "vivid" }), { primaryMode: "vivid" }).checked;
    expect(acc - viv).toBe(AUDIT_PAIRS.filter((p) => p.textPrimary).reduce((n, p) => n + (p.modes ? p.modes.length : 2), 0));
  });
  test("a broken token is reported with its pair name, mode, ratio and gate", () => {
    const t = buildTheme({ hue: 255 });
    const bad = { light: t.light, dark: { ...t.dark, "muted-foreground": t.dark.muted } };
    const r = auditTheme(bad);
    const f = r.failed.find((x) => x.name === "muted-foreground on muted" && x.mode === "dark")!;
    expect(f).toBeDefined();
    expect(f.ratio).toBeCloseTo(1, 1);
    expect(f.min).toBe(4.5);
  });
  test("vivid exempts only the text-primary pairs; auditing a vivid yellow theme as accessible fails exactly those", () => {
    const v = buildTheme({ hue: 106, primaryMode: "vivid" });
    expect(auditTheme(v, { primaryMode: "vivid" }).failed).toEqual([]);
    const r = auditTheme(v);
    expect(r.failed.length).toBeGreaterThan(0);
    for (const f of r.failed) expect(AUDIT_PAIRS.find((p) => p.name === f.name)!.textPrimary).toBe(true);
  });
  test("thin lists pairs within the margin of their gate; info lists translucent text that is not gated", () => {
    const r = auditTheme(buildTheme({ hue: 255, neutral: "warm" }), { margin: 0.3 });
    expect(r.thin.length).toBeGreaterThan(0);
    for (const x of r.thin) { expect(x.ratio).toBeGreaterThanOrEqual(x.min); expect(x.ratio).toBeLessThan(x.min + 0.3); }
    expect(r.info.length).toBe(ALPHA_TEXT.length * 2);
  });
  test("pairRatio composites alpha like a browser (a half-transparent text is lower than the solid one)", () => {
    const t = buildTheme({ hue: 255 }).light;
    const solid = pairRatio({ name: "s", fg: "foreground", bg: "background", min: 7 }, t);
    const half = pairRatio({ name: "h", fg: "foreground", bg: "background", min: 7, fgA: 0.5 }, t);
    expect(half).toBeLessThan(solid);
  });
  test("charts export", () => { expect(CHARTS).toEqual(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]); });
});
