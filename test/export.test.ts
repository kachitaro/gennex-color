import { describe, expect, test } from "bun:test";
import { formatHex, parse } from "culori";
import { toCss, toOklchCss } from "../src/css";
import { toDtcg } from "../src/dtcg";
import { CORE_HUES } from "../src/hues";
import { PRESETS } from "../src/presets";
import { TOKEN_NAMES, buildTheme, type Theme } from "../src/theme";
import { check } from "./pairs";

// shadcn/ui theming docs (fetched 2026-11-04): the token list its components use.
const SHADCN = ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground", "accent", "accent-foreground", "destructive", "border", "input", "ring", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground", "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring"];
const th = buildTheme({ hue: 217 });
const css = toCss(th);
const block = (name: string) => {
  const i = css.indexOf(name + " {");
  expect(i).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("\n}", i));
};
const vars = (b: string) => Object.fromEntries([...b.matchAll(/^\s+--([\w-]+): ([^;]+);$/gm)].map((m) => [m[1], m[2]]));

describe("toOklchCss", () => {
  test("formats oklch(L C h) and round-trips to the same 8-bit hex for every token", () => {
    for (const hue of [0, 25, 106, 217, 292, 355]) for (const neutral of ["cool", "neutral", "warm", "auto"] as const) {
      const t = buildTheme({ hue, neutral });
      for (const m of ["light", "dark"] as const) for (const [k, hex] of Object.entries(t[m])) {
        const s = toOklchCss(hex);
        expect([k, s]).toEqual([k, expect.stringMatching(/^oklch\(\d(\.\d+)? \d(\.\d+)? \d+(\.\d+)?\)$/)]);
        expect([k, formatHex(parse(s)!)]).toEqual([k, hex]);
      }
    }
  });
  test("achromatic colors have chroma 0, no NaN", () => {
    expect(toOklchCss("#808080")).toMatch(/^oklch\(0\.\d+ 0 0\)$/);
    expect(toOklchCss("#ffffff")).not.toContain("NaN");
  });
});

describe("toCss (shadcn + Tailwind v4)", () => {
  test(":root, .dark and @theme inline blocks exist, in that order", () => {
    const [a, b, c] = [css.indexOf(":root {"), css.indexOf(".dark {"), css.indexOf("@theme inline {")];
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(css.endsWith("\n")).toBe(true);
  });
  test("every shadcn token name is defined in :root and .dark as oklch(), with our values", () => {
    for (const [name, mode] of [[":root", "light"], [".dark", "dark"]] as const) {
      const v = vars(block(name));
      for (const k of SHADCN) {
        expect([name, k, v[k]]).toEqual([name, k, expect.stringMatching(/^oklch\(/)]);
        expect(v[k]).toBe(toOklchCss(th[mode][k]));
      }
      for (const k of TOKEN_NAMES) expect(v[k]).toBeDefined(); // our extra tokens too
      expect(Object.values(v).some((x) => x.startsWith("#"))).toBe(false);
    }
    expect(vars(block(":root")).radius).toBe("0.625rem");
  });
  test("@theme inline maps every token to --color-* via var(), plus the shadcn radius scale", () => {
    const b = block("@theme inline");
    for (const k of TOKEN_NAMES) expect(b).toContain(`--color-${k}: var(--${k});`);
    for (const [n, f] of [["sm", "0.6"], ["md", "0.8"], ["lg", ""], ["xl", "1.4"], ["2xl", "1.8"], ["3xl", "2.2"], ["4xl", "2.6"]]) {
      expect(b).toContain(f ? `--radius-${n}: calc(var(--radius) * ${f});` : `--radius-${n}: var(--radius);`);
    }
  });
  test("custom radius, deterministic output", () => {
    expect(toCss(th, { radius: "0.5rem" })).toContain("--radius: 0.5rem;");
    expect(toCss(th)).toBe(css);
  });
});

describe("toDtcg (Design Tokens 2025.10 color module)", () => {
  const d = toDtcg(th) as any;
  test("light and dark groups hold every token as $type color with srgb components and hex", () => {
    for (const m of ["light", "dark"] as const) {
      expect(Object.keys(d[m]).sort()).toEqual([...TOKEN_NAMES].sort());
      for (const k of TOKEN_NAMES) {
        const tok = d[m][k];
        expect(tok.$type).toBe("color");
        expect(tok.$value.colorSpace).toBe("srgb");
        expect(tok.$value.hex).toBe(th[m][k]);
        expect(tok.$value.components).toHaveLength(3);
        const hex = "#" + tok.$value.components.map((c: number) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
        expect(hex).toBe(th[m][k]);
        for (const c of tok.$value.components) expect(c >= 0 && c <= 1).toBe(true);
        expect(tok.$value.alpha).toBeUndefined();
      }
    }
  });
  test("is plain JSON and deterministic", () => {
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    expect(toDtcg(th)).toEqual(d);
    expect(typeof d.$description).toBe("string");
  });
  test("names contain none of the characters DTCG forbids ({ } .)", () => {
    for (const k of TOKEN_NAMES) expect(k).not.toMatch(/[{}.]/);
  });
});

describe("presets", () => {
  test("one preset per core hue, named after it", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(CORE_HUES.map((c) => c.name).sort());
    for (const c of CORE_HUES) expect(PRESETS[c.name].hue).toBe(c.hue);
  });
  test("every preset passes every contrast gate and builds CSS", () => {
    for (const [name, o] of Object.entries(PRESETS)) {
      expect(check(o, name)).toEqual([]);
      expect(toCss(buildTheme(o))).toContain("--primary:");
    }
  });
  test("themes are Theme-shaped", () => {
    const t: Theme = buildTheme(PRESETS.blue);
    expect(Object.keys(t)).toEqual(["light", "dark"]);
  });
});
