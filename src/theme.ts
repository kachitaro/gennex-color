import { contrast, deltaE, luminance, maxChroma, mixHex, toHex } from "./color";
import { CORE_HUES } from "./hues";
import { autoRamp, generateNeutral, neutralBorder, type NeutralRamp, type NeutralRampName } from "./neutral";
import { Y_PIVOT, foregroundFor, generateScale, type Mode, type Scale } from "./scale";

export type StatusName = "destructive" | "success" | "warning" | "info";
export interface ThemeOptions {
  /** Brand seed, any OKLCH hue 0-360 (not limited to the core hues). */
  hue: number;
  /** Brand chroma, 0.35-0.85. Default 0.85. */
  kappa?: number;
  /** Neutral ramp; "auto" follows the brand hue. Default "neutral". */
  neutral?: NeutralRampName | "auto" | NeutralRamp;
  /** Hue per status color; defaults to STATUS_HUES. */
  status?: Partial<Record<StatusName, number>>;
  /** 2 = page uses neutral step 2 (SPEC 3.3). Default 1. */
  pageStep?: 1 | 2;
}
/** token name -> sRGB hex */
export type TokenMap = Record<string, string>;
export interface Theme { light: TokenMap; dark: TokenMap }

export const STATUS_NAMES: readonly StatusName[] = ["destructive", "success", "warning", "info"];
/** red, green, amber, blue core hues */
export const STATUS_HUES: Record<StatusName, number> = { destructive: 25, success: 156, warning: 80, info: 255 };

const STATUS_SUFFIXES = ["", "-foreground", "-subtle", "-text", "-border"] as const;
export const TOKEN_NAMES: readonly string[] = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "primary-hover",
  "secondary", "secondary-foreground", "muted", "muted-foreground", "accent", "accent-foreground",
  "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground", "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
  ...STATUS_NAMES.flatMap((s) => STATUS_SUFFIXES.map((x) => s + x)),
];

const RING_TARGET = 3.05; // above the 3:1 floor for 8-bit rounding
const TEXT_TARGET = 4.55; // above the 4.5:1 floor for 8-bit rounding

/**
 * A solid color that shadcn also uses as TEXT (`text-primary`, `text-destructive`). Step 9 (and its hover, step 10) is kept
 * when it already reads as text on every surface and carries a foreground on itself, on its hover and on its translucent
 * form (`fgBgs`). Otherwise L moves from step 9 toward the text pole (darker in light, lighter in dark) just far enough,
 * keeping hue and kappa-scaled chroma; the hover is 0.03 L further away from the pivot, like in the scale.
 */
function solidWithText(base: Scale, hue: number, mode: Mode, kappa: number, textOk: (c: string) => boolean, fgBgs: (c: string, hover: string) => string[]) {
  const [s9, s10] = [base.hex[8], base.hex[9]];
  const fg0 = foregroundFor(hue, fgBgs(s9, s10));
  if (textOk(s9) && fg0.ok) return { solid: s9, hover: s10, foreground: fg0.hex };
  const at = (l: number) => { const c = { l, c: kappa * maxChroma(l, hue), h: hue }; return { c, hex: toHex(c) }; };
  const dir = mode === "light" ? -1 : 1;
  for (let l = base.steps[8].l + dir * 0.005; l > 0.12 && l < 0.97; l += dir * 0.005) {
    const s = at(l);
    if (!textOk(s.hex)) continue;
    const hover = at(luminance(s.c) < Y_PIVOT ? l - 0.03 : l + 0.03).hex;
    const fg = foregroundFor(hue, fgBgs(s.hex, hover));
    if (fg.ok) return { solid: s.hex, hover, foreground: fg.hex };
  }
  const fg = foregroundFor(hue, fgBgs(base.hex[11], base.hex[10]));
  return { solid: base.hex[11], hover: base.hex[10], foreground: fg.hex };
}

function modeTokens(o: ThemeOptions, mode: Mode): TokenMap {
  const ramp = o.neutral === "auto" ? autoRamp(o.hue) : (o.neutral ?? "neutral");
  const neutral = generateNeutral({ mode, ramp });
  const N = neutral.hex;
  const brand = generateScale({ hue: o.hue, mode, kappa: o.kappa });

  // Surfaces (SPEC 3.3): default page = N1, card = N1 (light) / N2 (dark). pageStep 2 shifts the page to N2 and the card to N1 / N3.
  const p2 = o.pageStep === 2;
  const bgIdx = p2 ? 1 : 0;
  const cardIdx = mode === "light" ? 0 : p2 ? 2 : 1;
  const background = N[bgIdx], card = N[cardIdx];

  const sidebar = N[1]; // step 2 in both modes (shadcn sidebar surface)
  const surfaces = [background, card, sidebar];
  // First of [s9..s12] that clears 3:1 on every surface it can sit on (pale brands such as yellow fall back to s11).
  const solid = (hex: string[], on: string[]) => hex.slice(8).find((c) => on.every((s) => contrast(c, s) >= RING_TARGET))!;
  const ring = solid(brand.hex, surfaces);
  // O9: shadcn renders text-primary / text-destructive as TEXT on surfaces and on translucent tints (bg-destructive/10, ...).
  const muted = N[2];
  const textSurfaces = [background, card, muted, sidebar];
  const kappa = o.kappa ?? 0.85;
  const primary = solidWithText(
    brand, o.hue, mode, kappa,
    (c) => textSurfaces.every((s) => contrast(c, s) >= TEXT_TARGET) && [background, card].every((s) => contrast(c, mixHex(muted, s, 0.5)) >= TEXT_TARGET),
    (c, h) => [c, h, ...[background, card, sidebar].map((s) => mixHex(c, s, 0.8))], // hover:bg-primary/80 keeps its text
  );
  const tints = mode === "light" ? [0.1, 0.2] : [0.2, 0.3]; // bg-destructive/10 (+hover /20); dark:/20 (+hover /30)
  const destructiveScale = generateScale({ hue: o.status?.destructive ?? STATUS_HUES.destructive, mode });
  const destructive = solidWithText(
    destructiveScale, o.status?.destructive ?? STATUS_HUES.destructive, mode, 0.85,
    (c) => textSurfaces.every((s) => contrast(c, s) >= TEXT_TARGET) && tints.every((a) => [background, card].every((s) => contrast(c, mixHex(c, s, a)) >= TEXT_TARGET))
      && [0.8, 0.9].every((a) => contrast(mixHex(c, card, a), card) >= TEXT_TARGET), // alert description /90, attachment error /80
    (c) => [c],
  );
  const t: TokenMap = {
    background, foreground: N[11],
    card, "card-foreground": N[11], popover: card, "popover-foreground": N[11],
    primary: primary.solid, "primary-foreground": primary.foreground, "primary-hover": primary.hover,
    secondary: N[2], "secondary-foreground": N[11],
    muted: N[2], "muted-foreground": N[10],
    accent: N[3], "accent-foreground": N[11],
    border: N[5], input: neutralBorder(neutral, [...new Set([bgIdx, cardIdx, 1])]).hex, ring,
    sidebar, "sidebar-foreground": N[11], "sidebar-primary": primary.solid, "sidebar-primary-foreground": primary.foreground,
    "sidebar-accent": N[3], "sidebar-accent-foreground": N[11], "sidebar-border": N[5], "sidebar-ring": ring,
  };
  chartColors(o, mode, brand.hex[8], [background, card]).forEach((c, i) => (t[`chart-${i + 1}`] = c));
  for (const s of STATUS_NAMES) {
    const sc = s === "destructive" ? destructiveScale : generateScale({ hue: o.status?.[s] ?? STATUS_HUES[s], mode });
    const solid = s === "destructive" ? destructive : { solid: sc.hex[8], foreground: sc.foreground };
    Object.assign(t, { [s]: solid.solid, [`${s}-foreground`]: solid.foreground, [`${s}-subtle`]: sc.hex[2], [`${s}-text`]: sc.hex[10], [`${s}-border`]: sc.hex[6] });
  }
  return t;
}

export function buildTheme(o: ThemeOptions): Theme {
  return { light: modeTokens(o, "light"), dark: modeTokens(o, "dark") };
}

/**
 * 5 chart series: core hues at least 22 degrees from the brand, each lifted to 3:1 on the given surfaces, then picked
 * greedily so every new color maximizes its minimum distance (OKLab) to the brand and the colors already chosen.
 */
function chartColors(o: ThemeOptions, mode: Mode, primary: string, on: string[]): string[] {
  const cand = CORE_HUES.filter((c) => hueGap(c.hue, o.hue) >= 22).map((c) => {
    const hex = generateScale({ hue: c.hue, mode }).hex;
    return hex.slice(8).find((x) => on.every((s) => contrast(x, s) >= RING_TARGET))!;
  });
  const chosen: string[] = [];
  const left = [...cand];
  while (chosen.length < 5) {
    const refs = [primary, ...chosen];
    let best = 0, bestD = -1;
    left.forEach((c, i) => {
      const d = Math.min(...refs.map((r) => deltaE(c, r)));
      if (d > bestD) { bestD = d; best = i; }
    });
    chosen.push(left.splice(best, 1)[0]);
  }
  return chosen;
}
const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
