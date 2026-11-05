import { converter } from "culori";
import snapshot from "../presets/devglow.snapshot.json";
import { maxChroma } from "./color";
import { configToThemeOptions, normalizeConfig, type ThemeConfig } from "./code";
import type { NeutralRamp } from "./neutral";
import type { ThemeOptions } from "./theme";

const toOklch = converter("oklch");
const round = (n: number, d: number) => +n.toFixed(d);
/** Cap of the neutral's step-9 chroma (both modes by default). */
const LIGHT_CHROMA_CAP = 0.03;
const ACCENTS = ["RED", "GREEN", "BLUE", "ORANGE", "YELLOW", "PINK", "GOLD", "TEAL", "SKY", "WINE"];
const SURFACES = ["BACKGROUND", "DARK_00", "DARK_01", "DARK_02", "DARK_03"];

/**
 * devglow palette -> the parts of a theme that come from the data (SPEC 8.1): the neutral ramp and kappa.
 * Neutral hue = chroma-weighted circular mean over the surface colors; chroma at step 9 is extrapolated from DARK_02/03
 * (about steps 3-4 and 5-6 of our ramp) and capped at 0.03; `canvas.dark` = lightness of BACKGROUND. A palette whose surfaces
 * carry no tint stays grey. `darkChromaCap` (optional) lets dark mode follow the palette further than the 0.03 cap that
 * light keeps: `neutral.chromaDark = min(cap, raw)`. Kappa = median accent saturation C / Cmax(L, h), clamped to [0.35, 0.85].
 */
export function derivePreset(colors: Record<string, string>, opts: { darkChromaCap?: number } = {}): { neutral: NeutralRamp; kappa: number } {
  const surf = SURFACES.map((k) => toOklch(colors[k])!);
  let x = 0, y = 0, total = 0;
  for (const o of surf) if (o.c >= 0.001) { x += o.c * Math.cos(((o.h ?? 0) * Math.PI) / 180); y += o.c * Math.sin(((o.h ?? 0) * Math.PI) / 180); total += o.c; }
  const tinted = total >= 0.004;
  const hue = tinted ? ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 : 0;
  const raw = tinted ? (surf[3].c / 0.31 + surf[4].c / 0.49) / 2 : 0;
  const c9 = Math.min(LIGHT_CHROMA_CAP, raw);
  const k = ACCENTS.map((n) => toOklch(colors[n])!).filter((o) => o.c >= 0.03).map((o) => o.c / maxChroma(o.l, o.h ?? 0)).sort((a, b) => a - b);
  const kappa = Math.min(0.85, Math.max(0.35, k[Math.floor(k.length / 2)]));
  const neutral: NeutralRamp = { hue: round(hue, 1), chroma: round(c9, 4), canvas: { dark: round(surf[0].l, 3) } };
  if (opts.darkChromaCap !== undefined) neutral.chromaDark = round(Math.min(opts.darkChromaCap, raw), 4);
  return { neutral, kappa: round(kappa, 2) };
}

/** Brand seed per palette, picked by hand from its mood text (SPEC D9), not read from the data. */
export const DEVGLOW_SEED_HUES: Record<string, number> = { sage: 150, ember: 40, blush: 5, amber: 75, dusk: 355, vesper: 175, moss: 135, tide: 200, mocha: 60, plum: 320, ash: 107, nocturne: 270 };

const palettes = snapshot.palettes as Record<string, { colors: Record<string, string>; tagline: string }>;
export const DEVGLOW_TAGLINES: Record<string, string> = Object.fromEntries(Object.entries(palettes).map(([n, p]) => [n, p.tagline]));

/** Proposed dark cap (SPEC 12.6): 0.06 gets most of the fit to devglow's own surfaces; above it the gain is flat. Not the default. */
export const DEVGLOW_DARK_CHROMA_CAP = 0.06;

/**
 * A devglow preset as an explicit, quantized configuration: hand-picked seed hue, neutral ramp and kappa from the palette data.
 * This is the single source of the preset: the static CSS, the DTCG file, the registry item and the share code all come from it,
 * and the code stores these numbers (not the preset name), so re-syncing the devglow snapshot never changes an old code.
 * `darkChromaCap` lets the dark neutral follow the palette's tint beyond the default 0.03 cap.
 */
export function devglowConfig(name: string, opts: { darkChromaCap?: number } = {}): ThemeConfig {
  const d = derivePreset(palettes[name].colors, opts);
  const n = d.neutral;
  return normalizeConfig({ hue: DEVGLOW_SEED_HUES[name], kappa: d.kappa, neutral: { hue: n.hue, chroma: n.chroma, chromaDark: n.chromaDark, canvasDark: n.canvas?.dark } });
}

/** `buildTheme` options of a devglow preset (from its configuration). */
export function devglowPreset(name: string, opts: { darkChromaCap?: number } = {}): ThemeOptions {
  return configToThemeOptions(devglowConfig(name, opts));
}

/** One preset per devglow palette. Pinned commit: NOTICE. */
export const DEVGLOW_PRESETS: Record<string, ThemeOptions> = Object.fromEntries(Object.keys(palettes).map((n) => [n, devglowPreset(n)]));
