import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { formatHex } from "culori";
import { toCss } from "../src/css";
import { DEVGLOW_PRESETS, DEVGLOW_SEED_HUES, DEVGLOW_TAGLINES, derivePreset } from "../src/devglow";
import { toDtcg } from "../src/dtcg";
import { buildTheme } from "../src/theme";
import { KEYS, parseLuaPalette, parseTaglines } from "../tools/devglow-parse";
import { check } from "./pairs";
import { hueGap, okl } from "./util";

const snapshot = JSON.parse(readFileSync("presets/devglow.snapshot.json", "utf8")) as {
  source: { repo: string; sha: string; license: string; copyright: string; fetchedAt: string };
  palettes: Record<string, { colors: Record<string, string>; tagline: string }>;
};
const NAMES = ["amber", "ash", "blush", "dusk", "ember", "mocha", "moss", "nocturne", "plum", "sage", "tide", "vesper"];

// SPEC D9: seed hues picked by hand from the mood text of each palette.
const D9 = { sage: 150, ember: 40, blush: 5, amber: 75, dusk: 355, vesper: 175, moss: 135, tide: 200, mocha: 60, plum: 320, ash: 107, nocturne: 270 };
// SPEC Appendix B, measured on 5c131e1: neutral hue (null = grey) and raw kappa clamped to [0.35, 0.85].
const B = { amber: [89, 0.46], ash: [107, 0.35], blush: [18, 0.35], dusk: [297, 0.49], ember: [87, 0.57], mocha: [63, 0.52], moss: [128, 0.41], nocturne: [274, 0.46], plum: [305, 0.44], sage: [null, 0.49], tide: [252, 0.4], vesper: [null, 0.85] } as const;

describe("parsers", () => {
  const lua = readFileSync("test/fixtures/sage.lua", "utf8");
  test("parseLuaPalette reads the 17 keys as lowercase hex", () => {
    const p = parseLuaPalette(lua);
    expect(Object.keys(p).sort()).toEqual([...KEYS].sort());
    expect(p.BACKGROUND).toBe("#080808");
    expect(p.SKY).toBe("#7eaac7");
  });
  test("parseLuaPalette refuses a palette that is missing a key or has a malformed color", () => {
    expect(() => parseLuaPalette(lua.replace(/^\s*WINE.*$/m, ""))).toThrow(/WINE/);
    expect(() => parseLuaPalette(lua.replace("#080808", "#08080"))).toThrow(/BACKGROUND/);
  });
  test("parseTaglines reads '### Name — *one for ...*' headings", () => {
    const t = parseTaglines("intro\n### Sage — *one for the quiet night*\ntext\n### Ember — *one for the fire*\n");
    expect(t).toEqual({ sage: "one for the quiet night", ember: "one for the fire" });
  });
});

describe("snapshot (copied + pinned, D8)", () => {
  test("source is pinned to a full commit sha, MIT, with attribution", () => {
    expect(snapshot.source.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(snapshot.source.repo).toBe("https://github.com/phatnt199/devglow");
    expect(snapshot.source.license).toBe("MIT");
    expect(snapshot.source.copyright).toMatch(/Phat Nguyen/);
    expect(readFileSync("NOTICE", "utf8")).toContain(snapshot.source.sha);
  });
  test("12 palettes x 17 valid hex keys, each with its tagline", () => {
    expect(Object.keys(snapshot.palettes).sort()).toEqual(NAMES);
    for (const n of NAMES) {
      expect(Object.keys(snapshot.palettes[n].colors).sort()).toEqual([...KEYS].sort());
      for (const v of Object.values(snapshot.palettes[n].colors)) expect(v).toMatch(/^#[0-9a-f]{6}$/);
      expect(snapshot.palettes[n].tagline).toMatch(/^one for /);
    }
  });
});

describe("derivePreset (SPEC 8.1)", () => {
  test("neutral ramp follows the palette: hue near the measured one, grey stays grey, canvas = BACKGROUND lightness", () => {
    for (const n of NAMES) {
      const p = derivePreset(snapshot.palettes[n].colors);
      const [hue] = B[n as keyof typeof B];
      if (hue === null) expect(p.neutral.chroma).toBe(0);
      else expect(hueGap(p.neutral.hue, hue)).toBeLessThanOrEqual(4);
      expect(p.neutral.chroma).toBeLessThanOrEqual(0.03);
      expect(Math.abs(p.neutral.canvas!.dark! - okl(snapshot.palettes[n].colors.BACKGROUND).l)).toBeLessThan(0.001);
    }
  });
  test("kappa is the median accent saturation, clamped to [0.35, 0.85]", () => {
    for (const n of NAMES) {
      const k = derivePreset(snapshot.palettes[n].colors).kappa;
      expect([n, Math.abs(k - B[n as keyof typeof B][1]) <= 0.015]).toEqual([n, true]);
      expect(k).toBeGreaterThanOrEqual(0.35);
      expect(k).toBeLessThanOrEqual(0.85);
    }
  });
  test("mood: warm palettes get a warm neutral, cool palettes a cool one", () => {
    const hue = (n: string) => derivePreset(snapshot.palettes[n].colors).neutral.hue;
    for (const n of ["ember", "amber", "mocha", "moss"]) expect([n, hue(n) >= 55 && hue(n) <= 135]).toEqual([n, true]);
    for (const n of ["tide", "nocturne", "plum", "dusk"]) expect([n, hue(n) >= 240 && hue(n) <= 320]).toEqual([n, true]);
  });
  test("is pure: same colors in, same preset out", () => {
    const c = snapshot.palettes.ember.colors;
    expect(derivePreset(c)).toEqual(derivePreset({ ...c }));
  });
});

describe("DEVGLOW_PRESETS", () => {
  test("12 presets with the hand-picked seed hues (D9) and a tagline each", () => {
    expect(Object.keys(DEVGLOW_PRESETS).sort()).toEqual(NAMES);
    expect(DEVGLOW_SEED_HUES).toEqual(D9);
    for (const n of NAMES) {
      expect(DEVGLOW_PRESETS[n].hue).toBe(D9[n as keyof typeof D9]);
      expect(DEVGLOW_TAGLINES[n]).toBe(snapshot.palettes[n].tagline);
    }
  });
  test("every preset passes every contrast gate (both modes, both primaryModes) and exports CSS and DTCG", () => {
    for (const n of NAMES) for (const primaryMode of ["accessible", "vivid"] as const) {
      expect(check({ ...DEVGLOW_PRESETS[n], primaryMode }, `devglow-${n}`)).toEqual([]);
    }
    for (const n of NAMES) {
      const t = buildTheme(DEVGLOW_PRESETS[n]);
      expect(toCss(t)).toContain("--primary:");
      expect(Object.keys((toDtcg(t) as any).dark)).toHaveLength(Object.keys(t.dark).length);
      expect(formatHex(okl(t.dark.background) as never)).toBeDefined();
    }
  });
  test("dark canvas follows the palette: darkest palettes give a darker page than the default", () => {
    expect(okl(buildTheme(DEVGLOW_PRESETS.sage).dark.background).l).toBeLessThan(0.15);
    expect(okl(buildTheme(DEVGLOW_PRESETS.ember).dark.background).l).toBeGreaterThan(0.17);
  });
});
