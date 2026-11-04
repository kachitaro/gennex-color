import { contrast } from "./color";
import { autoRamp, generateNeutral, neutralBorder, type NeutralRamp, type NeutralRampName } from "./neutral";
import { generateScale, type Mode } from "./scale";

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
  ...STATUS_NAMES.flatMap((s) => STATUS_SUFFIXES.map((x) => s + x)),
];

const RING_TARGET = 3.05; // above the 3:1 floor for 8-bit rounding

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

  const ring = [brand.hex[8], brand.hex[9], brand.hex[10], brand.hex[11]].find((c) => contrast(c, background) >= RING_TARGET && contrast(c, card) >= RING_TARGET)!;
  const t: TokenMap = {
    background, foreground: N[11],
    card, "card-foreground": N[11], popover: card, "popover-foreground": N[11],
    primary: brand.hex[8], "primary-foreground": brand.foreground, "primary-hover": brand.hex[9],
    secondary: N[2], "secondary-foreground": N[11],
    muted: N[2], "muted-foreground": N[10],
    accent: N[3], "accent-foreground": N[11],
    border: N[5], input: neutralBorder(neutral, [...new Set([bgIdx, cardIdx])]).hex, ring,
  };
  for (const s of STATUS_NAMES) {
    const sc = generateScale({ hue: o.status?.[s] ?? STATUS_HUES[s], mode });
    Object.assign(t, { [s]: sc.hex[8], [`${s}-foreground`]: sc.foreground, [`${s}-subtle`]: sc.hex[2], [`${s}-text`]: sc.hex[10], [`${s}-border`]: sc.hex[6] });
  }
  return t;
}

export function buildTheme(o: ThemeOptions): Theme {
  return { light: modeTokens(o, "light"), dark: modeTokens(o, "dark") };
}
