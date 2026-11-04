import { CORE_HUES } from "./hues";
import type { ThemeOptions } from "./theme";

/** One built-in preset per core hue, neutral gray ramp. Brand seeds outside this list are fine: call buildTheme directly. */
export const PRESETS: Record<string, ThemeOptions> = Object.fromEntries(CORE_HUES.map((c) => [c.name, { hue: c.hue }]));
