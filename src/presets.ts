import { configToThemeOptions, normalizeConfig, type ThemeConfig } from "./code";
import { CORE_HUES } from "./hues";
import type { ThemeOptions } from "./theme";

/** A core-hue preset as an explicit, quantized configuration (the single source: CSS, DTCG, registry item and code come from it). */
export function presetConfig(name: string): ThemeConfig {
  const c = CORE_HUES.find((h) => h.name === name);
  if (!c) throw new Error(`unknown preset "${name}"`);
  return normalizeConfig({ hue: c.hue });
}

/** One built-in preset per core hue, neutral gray ramp. Brand seeds outside this list are fine: call buildTheme directly. */
export const PRESETS: Record<string, ThemeOptions> = Object.fromEntries(CORE_HUES.map((c) => [c.name, configToThemeOptions(presetConfig(c.name))]));
