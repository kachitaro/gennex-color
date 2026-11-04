import { describe, expect, test } from "bun:test";
import * as R from "@radix-ui/colors";
import { SCALE_CACHE_LIMIT, clearScaleCache, generateScale, generateScaleUncached, scaleCacheSize, type Mode } from "../src/scale";
import { buildTheme } from "../src/theme";
import { CORE_HUES } from "../src/hues";
import { cr, dE, hueGap, inSrgb, maxChroma, okl, seeds } from "./util";

const MODES: Mode[] = ["light", "dark"];
const gen = (hue: number, mode: Mode, kappa?: number) => generateScale({ hue, mode, kappa });

/** Collect failures so one assertion reports every offending seed. */
function sweep(hs: number[], kappas: (number | undefined)[], f: (hue: number, mode: Mode, k?: number) => string | null) {
  const bad: string[] = [];
  for (const k of kappas) for (const m of MODES) for (const h of hs) {
    const r = f(h, m, k);
    if (r) bad.push(`${m} h=${h} k=${k ?? "def"}: ${r}`);
  }
  return bad;
}

describe("shape (A1, hue invariance)", () => {
  test("12 steps, in sRGB gamut, hue equals seed", () => {
    expect(sweep(seeds(1), [undefined], (h, m) => {
      const s = gen(h, m);
      if (s.steps.length !== 12 || s.hex.length !== 12) return "length";
      for (const [i, st] of s.steps.entries()) {
        if (!inSrgb(st)) return `step ${i + 1} out of gamut`;
        if (st.c > 0.002 && hueGap(st.h, h) > 0.01) return `step ${i + 1} hue ${st.h}`;
      }
      return null;
    })).toEqual([]);
  });
  test("deterministic", () => {
    expect(gen(123.4, "dark")).toEqual(gen(123.4, "dark"));
  });
});

describe("A2 lightness ladder", () => {
  test("monotone steps 1-8 with minimum spacing", () => {
    expect(sweep(seeds(5), [undefined, 0.35], (h, m, k) => {
      const L = gen(h, m, k).steps.map((s) => s.l);
      for (let i = 0; i < 7; i++) {
        const d = m === "light" ? L[i] - L[i + 1] : L[i + 1] - L[i];
        if (d < (i === 0 ? 0.008 : 0.02)) return `step ${i + 1}->${i + 2} dL=${d.toFixed(3)}`;
      }
      return null;
    })).toEqual([]);
  });
});

describe("A3 text steps", () => {
  test("step 11 >= 4.5 and step 12 >= 7 on steps 1-3 (8-bit hex)", () => {
    expect(sweep(seeds(1), [undefined, 0.35, 0.6], (h, m, k) => {
      const x = gen(h, m, k).hex;
      for (const b of [0, 1, 2]) {
        if (cr(x[10], x[b]) < 4.5) return `s11/s${b + 1}=${cr(x[10], x[b]).toFixed(2)}`;
        if (cr(x[11], x[b]) < 7) return `s12/s${b + 1}=${cr(x[11], x[b]).toFixed(2)}`;
      }
      return null;
    })).toEqual([]);
  });
});

describe("A4 foreground on solid steps (O1 dead zone)", () => {
  const check = (h: number, m: Mode, k?: number) => {
    const s = gen(h, m, k);
    const a = cr(s.foreground, s.hex[8]), b = cr(s.foreground, s.hex[9]);
    return Math.min(a, b) < 4.5 ? `fg/s9=${a.toFixed(2)} fg/s10=${b.toFixed(2)}` : null;
  };
  test("named O1 seeds 33, 246, 249", () => {
    expect(sweep([33, 246, 249], [undefined], check)).toEqual([]);
  });
  test("every integer hue, both modes, kappa 0.85", () => {
    expect(sweep(seeds(1), [undefined], check)).toEqual([]);
  });
  test("every 3 degrees at low/mid kappa (presets use 0.35-0.85)", () => {
    expect(sweep(seeds(3), [0.35, 0.6], check)).toEqual([]);
  });
  test("12 core hues keep s9 and s10 distinguishable (T4)", () => {
    const bad = CORE_HUES.filter(({ hue }) => dE(gen(hue, "light").hex[8], gen(hue, "light").hex[9]) < 0.02).map((h) => h.name);
    expect(bad).toEqual([]);
  });
});

describe("A5 continuity under the slider", () => {
  test("no step moves more than 0.02 dE per 1 degree of seed", () => {
    expect(sweep(seeds(1), [undefined], (h, m) => {
      const a = gen(h, m).steps, b = gen((h + 1) % 360, m).steps;
      for (let i = 0; i < 12; i++) {
        const d = dE(a[i], b[i]);
        if (d > 0.02) return `step ${i + 1} dE=${d.toFixed(3)}`;
      }
      return null;
    })).toEqual([]);
  });
});

describe("A6 chroma not washed out", () => {
  test("step 9 chroma >= 0.9 * kappa * Cmax", () => {
    expect(sweep(seeds(5), [undefined, 0.35, 0.6], (h, m, k) => {
      const s = gen(h, m, k).steps[8];
      const want = 0.9 * (k ?? 0.85) * maxChroma(s.l, h);
      return s.c < want ? `C9=${s.c.toFixed(3)} < ${want.toFixed(3)}` : null;
    })).toEqual([]);
  });
});

describe("H1/H2 core hue set", () => {
  const hs = CORE_HUES.map((c) => c.hue);
  test("hue gap >= 22 degrees", () => {
    let min = 360;
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) min = Math.min(min, hueGap(hs[i], hs[j]));
    expect(min).toBeGreaterThanOrEqual(22);
  });
  test("step 9 dE >= 0.05 between any two core hues (light)", () => {
    let min = 9;
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) min = Math.min(min, dE(gen(hs[i], "light").hex[8], gen(hs[j], "light").hex[8]));
    expect(min).toBeGreaterThanOrEqual(0.05);
  });
});

describe("R1 proximity to Radix 3.0.0", () => {
  const PAIRS: Record<string, string> = { red: "red", orange: "orange", amber: "amber", yellow: "yellow", lime: "lime", green: "green", teal: "teal", cyan: "cyan", blue: "blue", violet: "violet", magenta: "plum", pink: "pink" };
  test("mean dE over steps 1-8, 11-12 <= 0.035 (light and dark)", () => {
    const idx = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11];
    for (const m of MODES) {
      let total = 0;
      for (const r of Object.values(PAIRS)) {
        const rad = Array.from({ length: 12 }, (_, i) => (R as any)[r + (m === "dark" ? "Dark" : "")][r + (i + 1)] as string);
        const ours = gen(okl(rad[8]).h, m).hex;
        total += idx.reduce((a, i) => a + dE(ours[i], rad[i]), 0) / idx.length;
      }
      expect(total / 12).toBeLessThanOrEqual(0.035);
    }
  });
});

describe("T4 hover step is visibly different at EVERY hue", () => {
  test("dE(s9, s10) >= 0.02 every 0.5 degrees, all kappas, both modes", () => {
    expect(sweep(seeds(0.5), [0.35, 0.5, 0.6, 0.7, 0.85], (h, m, k) => {
      const s = gen(h, m, k);
      const d = dE(s.hex[8], s.hex[9]);
      return d < 0.02 ? `dE=${d.toFixed(4)}` : null;
    })).toEqual([]);
  });
});

describe("generateScale cache", () => {
  test("same inputs give the same (identical) object; hue is normalized and kappa defaults share one entry", () => {
    clearScaleCache();
    const a = generateScale({ hue: 40, mode: "light" });
    expect(generateScale({ hue: 40, mode: "light", kappa: 0.85 })).toBe(a);
    expect(generateScale({ hue: 400, mode: "light" })).toBe(a);
    expect(generateScale({ hue: -320, mode: "light" })).toBe(a);
    expect(generateScale({ hue: 40, mode: "dark" })).not.toBe(a);
    expect(scaleCacheSize()).toBe(2);
  });
  test("cached results equal a fresh computation, before and after evictions", () => {
    clearScaleCache();
    const inputs = Array.from({ length: 3000 }, (_, i) => ({ hue: (i * 0.37) % 360, mode: (i % 2 ? "dark" : "light") as Mode, kappa: [0.35, 0.6, 0.85][i % 3] }));
    for (const o of inputs) generateScale(o);
    expect(scaleCacheSize()).toBeLessThanOrEqual(SCALE_CACHE_LIMIT);
    for (const o of [...inputs.slice(0, 40), ...inputs.slice(-40), ...inputs.filter((_, i) => i % 97 === 0)]) expect(generateScale(o)).toEqual(generateScaleUncached(o));
  });
  test("the cache is bounded and keeps recently used entries (LRU)", () => {
    clearScaleCache();
    const first = generateScale({ hue: 1, mode: "light" });
    for (let i = 0; i < SCALE_CACHE_LIMIT - 1; i++) generateScale({ hue: 2 + i * 0.01, mode: "light" });
    generateScale({ hue: 1, mode: "light" }); // touch: becomes most recent
    generateScale({ hue: 359, mode: "dark" }); // forces one eviction: the oldest untouched entry, not `first`
    expect(scaleCacheSize()).toBe(SCALE_CACHE_LIMIT);
    expect(generateScale({ hue: 1, mode: "light" })).toBe(first);
  });
  test("cached scales are read-only so one caller cannot corrupt another", () => {
    const s = generateScale({ hue: 200, mode: "dark" });
    expect(() => { (s.hex as string[])[0] = "#000000"; }).toThrow();
    expect(() => { (s.steps[0] as { l: number }).l = 0; }).toThrow();
    expect(Object.isFrozen(s)).toBe(true);
  });
  test("buildTheme gives the same tokens with a cold and a warm cache", () => {
    for (const o of [{ hue: 40 }, { hue: 255, neutral: "auto" as const, primaryMode: "vivid" as const }, { hue: 106, kappa: 0.5, pageStep: 2 as const }]) {
      clearScaleCache();
      const cold = buildTheme(o);
      expect(buildTheme(o)).toEqual(cold);
      clearScaleCache();
      expect(buildTheme(o)).toEqual(cold);
    }
  });
});
