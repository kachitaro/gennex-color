import { describe, expect, test } from "bun:test";
import { CORE_HUES } from "../src/hues";
import { generateScale, type Mode } from "../src/scale";
import { STATUS_HUES, STATUS_NAMES, TOKEN_NAMES, buildTheme, type ThemeOptions, type TokenMap } from "../src/theme";
import { cr, dE, okl, seeds } from "./util";

const MODES: Mode[] = ["light", "dark"];
const NEUTRALS = ["cool", "neutral", "warm", "auto"] as const;

interface Pair { name: string; fg: string; bg: string; min: number }
/** Every text/surface pair of the mapping table (SPEC 3.3, T1-T3) and its gate. */
function pairs(): Pair[] {
  const out: Pair[] = [];
  const P = (fg: string, bg: string, min: number) => out.push({ name: `${fg} on ${bg}`, fg, bg, min });
  // T1 text: foreground 7:1 on every neutral surface, muted-foreground 4.5:1 on all of them
  for (const bg of ["background", "card", "popover", "muted", "secondary", "accent"]) {
    P(bg === "card" ? "card-foreground" : bg === "popover" ? "popover-foreground" : "foreground", bg, 7);
    P("muted-foreground", bg, 4.5);
  }
  P("foreground", "card", 7); P("foreground", "popover", 7);
  P("secondary-foreground", "secondary", 4.5);
  P("accent-foreground", "accent", 4.5);
  P("primary-foreground", "primary", 4.5);
  P("primary-foreground", "primary-hover", 4.5);
  // D7: every status has the same 5 tokens
  for (const s of STATUS_NAMES) {
    P(`${s}-foreground`, s, 4.5);
    for (const bg of ["background", "card", `${s}-subtle`]) P(`${s}-text`, bg, 4.5);
    P(`${s}-border`, "background", 1.2); // identification, not WCAG 1.4.11
  }
  // T3 non-text 3:1 (D4 strict input border, focus ring); border is decorative
  for (const bg of ["background", "card"]) { P("ring", bg, 3); P("input", bg, 3); P("border", bg, 1.2); }
  return out;
}
const PAIRS = pairs();

function violations(label: string, t: TokenMap): string[] {
  const bad: string[] = [];
  for (const p of PAIRS) {
    const r = cr(t[p.fg], t[p.bg]);
    if (r < p.min) bad.push(`${label}: ${p.name} ${r.toFixed(2)} < ${p.min}`);
  }
  return bad;
}
function check(o: ThemeOptions, label: string) {
  const th = buildTheme(o);
  return MODES.flatMap((m) => violations(`${label} ${m}`, th[m]));
}

describe("token set (C1, D7)", () => {
  test("TOKEN_NAMES covers shadcn names and 5 tokens per status", () => {
    for (const n of ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground", "accent", "accent-foreground", "destructive", "border", "input", "ring"]) expect(TOKEN_NAMES).toContain(n);
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
  test("brand is any seed: primary equals that seed's step 9; status hues are overridable", () => {
    for (const hue of [40, 64, 217.5]) {
      const th = buildTheme({ hue });
      for (const m of MODES) {
        const s = generateScale({ hue, mode: m });
        expect(th[m].primary).toBe(s.hex[8]);
        expect(th[m]["primary-hover"]).toBe(s.hex[9]);
        expect(th[m]["primary-foreground"]).toBe(s.foreground);
      }
    }
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
    for (const { name, hue } of CORE_HUES) for (const neutral of NEUTRALS) for (const pageStep of [1, 2] as const) for (const kappa of [0.85, 0.4]) {
      bad.push(...check({ hue, neutral, pageStep, kappa }, `${name} ${neutral} p${pageStep} k${kappa}`));
    }
    expect(bad).toEqual([]);
  });
  test("every integer brand seed, neutral auto and cool/page=s2", () => {
    const bad: string[] = [];
    for (const hue of seeds(1)) {
      bad.push(...check({ hue, neutral: "auto" }, `auto h${hue}`));
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
