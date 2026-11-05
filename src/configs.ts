import { normalizeConfig, type ThemeConfig } from "./code";
import { devglowPreset } from "./devglow";
import { PRESETS } from "./presets";
import type { NeutralRamp } from "./neutral";

/** A core-hue preset as an explicit configuration (what the share code stores). */
export function presetConfig(name: string): ThemeConfig {
  const o = PRESETS[name];
  if (!o) throw new Error(`unknown preset "${name}"`);
  return normalizeConfig({ hue: o.hue });
}

/**
 * A devglow preset as explicit values. The code stores the numbers, not the preset name, so re-syncing the devglow snapshot
 * never changes what an existing code means.
 */
export function devglowConfig(name: string, opts: { darkChromaCap?: number } = {}): ThemeConfig {
  const o = devglowPreset(name, opts);
  const n = o.neutral as NeutralRamp;
  return normalizeConfig({
    hue: o.hue,
    kappa: o.kappa,
    neutral: { hue: n.hue, chroma: n.chroma, chromaDark: n.chromaDark, canvasDark: n.canvas?.dark },
  });
}
