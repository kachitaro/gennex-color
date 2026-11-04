import { describe, expect, test } from "bun:test";
import * as R from "@radix-ui/colors";
import { AUTO_CHROMA, BLACK_ALPHA, NEUTRAL_RAMPS, WHITE_ALPHA, autoRamp, generateNeutral, neutralAlpha, type NeutralRamp, type NeutralRampName } from "../src/neutral";
import type { Mode } from "../src/scale";
import { cr, dE, hueGap, inSrgb, lum, seeds } from "./util";

const MODES: Mode[] = ["light", "dark"];
const NAMES: NeutralRampName[] = ["cool", "neutral", "warm"];
const radix = (name: string, mode: Mode) => Array.from({ length: 12 }, (_, i) => (R as any)[name + (mode === "dark" ? "Dark" : "")][name + (i + 1)] as string);
const gen = (ramp: NeutralRampName | NeutralRamp, mode: Mode) => generateNeutral({ ramp, mode });
const ALL: [string, NeutralRampName | NeutralRamp][] = [...NAMES.map((n) => [n, n] as [string, NeutralRampName]), ...[0, 25, 106, 255, 330].map((h) => [`auto ${h}`, autoRamp(h)] as [string, NeutralRamp])];

function channels(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/** sRGB-space source-over compositing, as CSS does. */
function over(bg: string, k: number[], a: number) {
  return channels(bg).map((b, i) => b + (k[i] - b) * a);
}
const hexOf = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

describe("shape", () => {
  test("12 steps, in sRGB gamut, lightness strictly monotone with spacing", () => {
    for (const [label, ramp] of ALL) for (const m of MODES) {
      const s = gen(ramp, m);
      expect([label, m, s.steps.length, s.hex.length]).toEqual([label, m, 12, 12]);
      for (const st of s.steps) expect(inSrgb(st)).toBe(true);
      for (let i = 0; i < 11; i++) {
        const d = m === "light" ? s.steps[i].l - s.steps[i + 1].l : s.steps[i + 1].l - s.steps[i].l;
        expect([label, m, i + 1, d >= 0.008]).toEqual([label, m, i + 1, true]);
      }
    }
  });
  test("fixed ramps: neutral has zero chroma, cool/warm keep their hue, chroma peaks at step 9", () => {
    for (const m of MODES) {
      expect(gen("neutral", m).steps.every((s) => s.c === 0)).toBe(true);
      for (const n of ["cool", "warm"] as const) {
        const s = gen(n, m).steps;
        for (const st of s) if (st.c > 0.002) expect(hueGap(st.h, NEUTRAL_RAMPS[n].hue)).toBeLessThan(0.01);
        expect(s.indexOf(s.reduce((a, b) => (b.c > a.c ? b : a)))).toBe(8);
        expect(s[8].c).toBeCloseTo(NEUTRAL_RAMPS[n].chroma, 3);
      }
    }
  });
  test("named ramps: cool is blue-ish, warm is orange-ish, neutral is neutral", () => {
    expect(NEUTRAL_RAMPS.cool.hue).toBeGreaterThan(240);
    expect(NEUTRAL_RAMPS.cool.hue).toBeLessThan(270);
    expect(NEUTRAL_RAMPS.warm.hue).toBeGreaterThan(50);
    expect(NEUTRAL_RAMPS.warm.hue).toBeLessThan(90);
    expect(NEUTRAL_RAMPS.neutral.chroma).toBe(0);
  });
});

describe("A3 text steps on neutral (s1-s4 = background, card, muted, accent surfaces)", () => {
  test("s11 >= 4.5 and s12 >= 7 on steps 1-4 for every named ramp", () => {
    for (const n of NAMES) for (const m of MODES) {
      const x = gen(n, m).hex;
      for (const b of [0, 1, 2, 3]) {
        expect([n, m, b + 1, cr(x[10], x[b]) >= 4.5]).toEqual([n, m, b + 1, true]);
        expect([n, m, b + 1, cr(x[11], x[b]) >= 7]).toEqual([n, m, b + 1, true]);
      }
    }
  });
  test("same for auto at every integer seed hue", () => {
    const bad: string[] = [];
    for (const m of MODES) for (const h of seeds(1)) {
      const x = gen(autoRamp(h), m).hex;
      for (const b of [0, 1, 2, 3]) {
        if (cr(x[10], x[b]) < 4.5) bad.push(`${m} h${h} s11/s${b + 1} ${cr(x[10], x[b]).toFixed(2)}`);
        if (cr(x[11], x[b]) < 7) bad.push(`${m} h${h} s12/s${b + 1} ${cr(x[11], x[b]).toFixed(2)}`);
      }
    }
    expect(bad).toEqual([]);
  });
  test("border step 9 is >= 3:1 on steps 1 and 2 (D4 strict input border / T3 ring)", () => {
    for (const [label, ramp] of ALL) for (const m of MODES) {
      const x = gen(ramp, m).hex;
      for (const b of [0, 1]) expect([label, m, b + 1, cr(x[8], x[b]) >= 3]).toEqual([label, m, b + 1, true]);
    }
  });
});

describe("auto ramp follows the seed (D5)", () => {
  test("hue = seed, chroma capped at AUTO_CHROMA (<= 0.016)", () => {
    expect(AUTO_CHROMA).toBeLessThanOrEqual(0.016);
    expect(AUTO_CHROMA).toBeGreaterThan(0);
    for (const h of seeds(7)) for (const m of MODES) for (const st of gen(autoRamp(h), m).steps) {
      expect(st.c).toBeLessThanOrEqual(AUTO_CHROMA + 1e-9);
      if (st.c > 0.002) expect(hueGap(st.h, h)).toBeLessThan(0.01);
    }
  });
  test("slider-continuous: every step moves < 0.002 dE per degree of seed", () => {
    let max = 0;
    for (const m of MODES) for (const h of seeds(1)) {
      const a = gen(autoRamp(h), m).steps, b = gen(autoRamp((h + 1) % 360), m).steps;
      for (let i = 0; i < 12; i++) max = Math.max(max, dE(a[i], b[i]));
    }
    expect(max).toBeLessThan(0.002);
  });
});

describe("proximity to Radix (R2)", () => {
  const mean = (a: string[], b: string[]) => a.reduce((s, x, i) => s + dE(x, b[i]), 0) / a.length;
  test("neutral ~ Radix gray; cool ~ Radix slate (mean dE <= 0.02)", () => {
    for (const m of MODES) {
      expect(mean(gen("neutral", m).hex, radix("gray", m))).toBeLessThanOrEqual(0.02);
      expect(mean(gen("cool", m).hex, radix("slate", m))).toBeLessThanOrEqual(0.02);
    }
  });
});

describe("neutral alpha (D6)", () => {
  test("composite over step 1 reproduces every step within 1/255; alpha in [0,1], step 1 transparent, non-decreasing", () => {
    for (const [label, ramp] of ALL) for (const m of MODES) {
      const s = gen(ramp, m), a = neutralAlpha(s);
      expect(a.length).toBe(12);
      expect(a[0].alpha).toBe(0);
      for (let i = 0; i < 12; i++) {
        expect([label, m, i + 1, a[i].alpha >= 0 && a[i].alpha <= 1]).toEqual([label, m, i + 1, true]);
        if (i > 0) expect([label, m, i + 1, a[i].alpha >= a[i - 1].alpha]).toEqual([label, m, i + 1, true]);
        const got = over(s.hex[0], [a[i].r, a[i].g, a[i].b], a[i].alpha), want = channels(s.hex[i]);
        for (let c = 0; c < 3; c++) expect([label, m, i + 1, c, Math.abs(got[c] - want[c]) <= 1]).toEqual([label, m, i + 1, c, true]);
        expect(a[i].css).toMatch(/^rgb\(\d+ \d+ \d+ \/ [01](\.\d+)?\)$/);
      }
    }
  });
  test("overlay direction: light mode darkens, dark mode lightens", () => {
    for (const [label, ramp] of ALL) for (const m of MODES) {
      const s = gen(ramp, m), a = neutralAlpha(s);
      for (let i = 1; i < 12; i++) {
        const k = hexOf([a[i].r, a[i].g, a[i].b]);
        expect([label, m, i + 1, m === "light" ? lum(k) <= lum(s.hex[0]) : lum(k) >= lum(s.hex[0])]).toEqual([label, m, i + 1, true]);
      }
    }
  });
  test("white/black alpha: 12 increasing values matching Radix 3.0.0", () => {
    const parse = (o: Record<string, string>) => Object.values(o).map((v) => Number(v.match(/([\d.]+)\)$/)![1]));
    expect([...BLACK_ALPHA]).toEqual(parse(R.blackA));
    expect([...WHITE_ALPHA]).toEqual(parse(R.whiteA));
    for (let i = 1; i < 12; i++) expect(BLACK_ALPHA[i]).toBeGreaterThan(BLACK_ALPHA[i - 1]);
  });
  test("black alpha text over light step 1 and white alpha over dark step 1 pass A3 (a11 >= 4.5, a12 >= 7)", () => {
    for (const n of NAMES) {
      const l = gen(n, "light").hex[0], d = gen(n, "dark").hex[0];
      expect(cr(hexOf(over(l, [0, 0, 0], BLACK_ALPHA[10])), l)).toBeGreaterThanOrEqual(4.5);
      expect(cr(hexOf(over(l, [0, 0, 0], BLACK_ALPHA[11])), l)).toBeGreaterThanOrEqual(7);
      expect(cr(hexOf(over(d, [255, 255, 255], WHITE_ALPHA[10])), d)).toBeGreaterThanOrEqual(4.5);
      expect(cr(hexOf(over(d, [255, 255, 255], WHITE_ALPHA[11])), d)).toBeGreaterThanOrEqual(7);
    }
  });
});
