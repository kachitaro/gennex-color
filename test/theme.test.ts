import { describe, expect, test } from "bun:test";
import { CORE_HUES } from "../src/hues";
import { generateScale, type Mode } from "../src/scale";
import { STATUS_HUES, STATUS_NAMES, TOKEN_NAMES, buildTheme, type ThemeOptions } from "../src/theme";
import { CHARTS, check } from "./pairs";
import { cr, dE, okl, seeds } from "./util";

const MODES: Mode[] = ["light", "dark"];
const NEUTRALS = ["cool", "neutral", "warm", "auto"] as const;

describe("token set (C1, D7)", () => {
  test("TOKEN_NAMES covers shadcn names and 5 tokens per status", () => {
    for (const n of ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground", "accent", "accent-foreground", "destructive", "border", "input", "ring", ...CHARTS, "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground", "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring"]) expect(TOKEN_NAMES).toContain(n);
    for (const s of STATUS_NAMES) for (const suf of ["", "-foreground", "-subtle", "-text", "-border"]) expect(TOKEN_NAMES).toContain(s + suf);
    expect(new Set(TOKEN_NAMES).size).toBe(TOKEN_NAMES.length);
  });
  test("light and dark define exactly TOKEN_NAMES, all 8-bit hex", () => {
    for (const hue of [0, 90, 200, 333]) {
      const th = buildTheme({ hue });
      for (const m of MODES) {
        expect(Object.keys(th[m]).sort()).toEqual([...TOKEN_NAMES].sort());
        for (const v of Object.values(th[m])) expect(v).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
  test("brand is any seed: primary keeps the seed hue and moves from step 9 only toward the text pole (darker in light, lighter in dark)", () => {
    for (const hue of [40, 64, 217.5]) {
      const th = buildTheme({ hue });
      for (const m of MODES) {
        const s = generateScale({ hue, mode: m }), p = okl(th[m].primary);
        expect([hue, m, m === "light" ? p.l <= s.steps[8].l + 0.002 : p.l >= s.steps[8].l - 0.002]).toEqual([hue, m, true]);
        expect(Math.min(Math.abs(p.h - hue), 360 - Math.abs(p.h - hue))).toBeLessThan(2.5);
        expect(th[m]["primary-hover"]).not.toBe(th[m].primary);
      }
    }
    // O9: lifted only when needed. A bright brand on a dark page already reads as text, so it keeps step 9 and hover step 10.
    const y = generateScale({ hue: 106, mode: "dark" }), yt = buildTheme({ hue: 106 }).dark;
    expect([yt.primary, yt["primary-hover"]]).toEqual([y.hex[8], y.hex[9]]);
    // ...but red in dark is too dark to be text on the page, so primary and destructive get lighter.
    const red = buildTheme({ hue: 25 }).dark, redScale = generateScale({ hue: 25, mode: "dark" });
    expect(okl(red.destructive).l).toBeGreaterThan(redScale.steps[8].l);
    expect(okl(red.primary).l).toBeGreaterThan(redScale.steps[8].l);
    expect(cr(red.destructive, red.background)).toBeGreaterThanOrEqual(4.5);
    const w = buildTheme({ hue: 255, status: { warning: 60 } });
    for (const m of MODES) {
      const s = generateScale({ hue: 60, mode: m });
      expect([w[m].warning, w[m]["warning-subtle"], w[m]["warning-text"], w[m]["warning-border"]]).toEqual([s.hex[8], s.hex[2], s.hex[10], s.hex[6]]);
    }
    expect(STATUS_HUES.destructive).toBeGreaterThan(0); // defaults exist (red ...)
    expect(Object.keys(STATUS_HUES).sort()).toEqual([...STATUS_NAMES].sort());
  });
});

describe("all text/surface pairs pass the gate (T1-T3)", () => {
  test("12 core hues x 4 neutrals x page=s1/s2 x kappa 0.85/0.4, both modes", () => {
    const bad: string[] = [];
    for (const { name, hue } of CORE_HUES) for (const neutral of NEUTRALS) for (const pageStep of [1, 2] as const) for (const kappa of [0.85, 0.4]) for (const primaryMode of ["accessible", "vivid"] as const) {
      bad.push(...check({ hue, neutral, pageStep, kappa, primaryMode }, `${name} ${neutral} p${pageStep} k${kappa} ${primaryMode}`));
    }
    expect(bad).toEqual([]);
  });
  test("every integer brand seed, neutral auto and cool/page=s2", () => {
    const bad: string[] = [];
    for (const hue of seeds(1)) {
      bad.push(...check({ hue, neutral: "auto" }, `auto h${hue}`));
      bad.push(...check({ hue, neutral: "auto", primaryMode: "vivid" }, `vivid h${hue}`));
      if (hue % 3 === 0) bad.push(...check({ hue, neutral: "cool", pageStep: 2 }, `cool p2 h${hue}`));
    }
    expect(bad).toEqual([]);
  });
  test("every status hue (all four statuses at the same hue, every 3 degrees)", () => {
    const bad: string[] = [];
    for (const h of seeds(3)) bad.push(...check({ hue: 255, status: { destructive: h, success: h, warning: h, info: h } }, `status h${h}`));
    expect(bad).toEqual([]);
  });
});

describe("structure (T4-T6)", () => {
  const cases: ThemeOptions[] = [...CORE_HUES.map((c) => ({ hue: c.hue })), ...NEUTRALS.map((neutral) => ({ hue: 40, neutral }))];
  test("T5: no pure black/white for background, foreground, card, popover", () => {
    for (const o of cases) for (const pageStep of [1, 2] as const) {
      const th = buildTheme({ ...o, pageStep });
      for (const m of MODES) for (const k of ["background", "foreground", "card", "popover"]) {
        const l = okl(th[m][k]).l;
        expect([m, k, l < 0.995 && l > 0.12]).toEqual([m, k, true]);
      }
    }
  });
  test("T6: dark is elevation, not an inversion", () => {
    for (const o of cases) {
      const d = buildTheme(o).dark, l = buildTheme(o).light;
      expect(okl(d.background).l).toBeLessThan(okl(d.card).l); // elevated surface is lighter
      expect(okl(d.card).l).toBeLessThanOrEqual(okl(d.popover).l);
      expect(l.card).toBe(l.background); // light default: card = page = step 1
      expect(okl(d.background).l).toBeLessThan(0.3);
      expect(okl(l.background).l).toBeGreaterThan(0.9);
      expect(l["muted-foreground"]).not.toBe(d["muted-foreground"]);
    }
  });
  test("page = s2: page is step 2, card is lighter than page (light) / one step up (dark)", () => {
    for (const o of cases) {
      const th = buildTheme({ ...o, pageStep: 2 }), def = buildTheme(o);
      for (const m of MODES) expect(th[m].background).not.toBe(def[m].background);
      expect(okl(th.light.card).l).toBeGreaterThan(okl(th.light.background).l);
      expect(okl(th.dark.card).l).toBeGreaterThan(okl(th.dark.background).l);
    }
  });
  test("T4: interactive states are distinguishable (primary vs hover, secondary vs accent, accent vs card)", () => {
    const bad: string[] = [];
    for (const hue of seeds(3)) for (const neutral of NEUTRALS) {
      const th = buildTheme({ hue, neutral });
      for (const m of MODES) {
        const t = th[m];
        for (const [a, b] of [["primary", "primary-hover"], ["secondary", "accent"], ["accent", "card"]]) {
          const d = dE(t[a], t[b]);
          if (d < 0.02) bad.push(`${m} h${hue} ${neutral} ${a}/${b} ${d.toFixed(3)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  test("input border is the strict solved one and ring clears 3:1 even for pale brands (yellow)", () => {
    const th = buildTheme({ hue: 106 }); // yellow s9 is ~1.3:1 on white, so ring must fall back to a deeper step
    for (const m of MODES) {
      expect(cr(th[m].ring, th[m].background)).toBeGreaterThanOrEqual(3);
      expect(cr(th[m].ring, th[m].card)).toBeGreaterThanOrEqual(3);
    }
    expect(th.light.ring).not.toBe(th.light.primary);
  });
});

describe("chart and sidebar tokens", () => {
  test("sidebar tokens follow the mapping: surface N2, accent N4, primary and ring shared with the app", () => {
    for (const hue of [25, 106, 255]) {
      const th = buildTheme({ hue });
      for (const m of MODES) {
        const t = th[m];
        expect(t["sidebar-primary"]).toBe(t.primary);
        expect(t["sidebar-primary-foreground"]).toBe(t["primary-foreground"]);
        expect(t["sidebar-ring"]).toBe(t.ring);
        expect(t["sidebar-accent"]).toBe(t.accent);
        expect(t["sidebar-border"]).toBe(t.border);
        expect(t["sidebar-foreground"]).toBe(t.foreground);
      }
    }
  });
  test("sidebar surface is neutral step 2: equals card in dark, slightly darker than the page in light", () => {
    const th = buildTheme({ hue: 255 });
    expect(th.dark.sidebar).toBe(th.dark.card);
    expect(okl(th.light.sidebar).l).toBeLessThan(okl(th.light.background).l);
  });
  test("5 chart colors: distinct from each other and from the brand (dE >= 0.05)", () => {
    const bad: string[] = [];
    for (const hue of seeds(5)) for (const neutral of NEUTRALS) {
      const th = buildTheme({ hue, neutral });
      for (const m of MODES) {
        const c = CHARTS.map((k) => th[m][k]);
        if (new Set(c).size !== 5) bad.push(`${m} h${hue} duplicate chart colors`);
        for (let i = 0; i < 5; i++) {
          if (dE(c[i], th[m].primary) < 0.05) bad.push(`${m} h${hue} ${neutral} chart-${i + 1} ~ primary ${dE(c[i], th[m].primary).toFixed(3)}`);
          for (let j = i + 1; j < 5; j++) if (dE(c[i], c[j]) < 0.05) bad.push(`${m} h${hue} ${neutral} chart-${i + 1}/${j + 1} ${dE(c[i], c[j]).toFixed(3)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  test("chart colors are deterministic and depend on the brand hue (brand-excluded set)", () => {
    expect(buildTheme({ hue: 25 }).light["chart-1"]).toBe(buildTheme({ hue: 25 }).light["chart-1"]);
    expect(buildTheme({ hue: 25 }).light["chart-1"]).not.toBe(buildTheme({ hue: 255 }).light["chart-1"]);
  });
});

describe("primaryMode: accessible (default) and vivid", () => {
  test("default is accessible, and there primary-text equals primary", () => {
    for (const hue of [25, 106, 255]) {
      const a = buildTheme({ hue }), b = buildTheme({ hue, primaryMode: "accessible" });
      expect(b).toEqual(a);
      for (const m of MODES) expect(a[m]["primary-text"]).toBe(a[m].primary);
    }
  });
  test("vivid keeps step 9 for hues whose step 9 only fails as text (yellow, amber, lime in light)", () => {
    for (const hue of [80, 106, 133]) {
      const v = buildTheme({ hue, primaryMode: "vivid" }).light, s = generateScale({ hue, mode: "light" });
      expect([hue, v.primary, v["primary-hover"]]).toEqual([hue, s.hex[8], s.hex[9]]);
    }
  });
  test("vivid never moves farther from step 9 than accessible, and primary-text carries the text duty", () => {
    for (const hue of seeds(5)) for (const m of MODES) {
      const s = generateScale({ hue, mode: m }), l9 = s.steps[8].l;
      const v = buildTheme({ hue, primaryMode: "vivid" })[m], a = buildTheme({ hue })[m];
      expect([hue, m, Math.abs(okl(v.primary).l - l9) <= Math.abs(okl(a.primary).l - l9) + 0.002]).toEqual([hue, m, true]);
      expect([hue, m, cr(v["primary-text"], v.background) >= 4.5]).toEqual([hue, m, true]);
    }
  });
  test("the trade-off is real: vivid yellow primary is not readable as text on a light page, primary-text is", () => {
    const v = buildTheme({ hue: 106, primaryMode: "vivid" }).light;
    expect(cr(v.primary, v.background)).toBeLessThan(4.5);
    expect(cr(v["primary-text"], v.background)).toBeGreaterThanOrEqual(4.5);
  });
});
