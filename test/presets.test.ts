import { describe, expect, test } from "bun:test";
import { configToThemeOptions, decodeCode, encodeConfig, normalizeConfig } from "../src/code";
import { toCss } from "../src/css";
import { DEVGLOW_PRESETS, devglowConfig } from "../src/devglow";
import { toDtcg } from "../src/dtcg";
import { PRESETS, presetConfig } from "../src/presets";
import { buildRegistry } from "../src/registry";
import { buildTheme } from "../src/theme";

const ALL: [string, string][] = [...Object.keys(PRESETS).map((n) => [n, n] as [string, string]), ...Object.keys(DEVGLOW_PRESETS).map((n) => [`devglow-${n}`, n] as [string, string])];
const configOf = (full: string, short: string) => (full.startsWith("devglow-") ? devglowConfig(short) : presetConfig(short));
const optionsOf = (full: string) => (full.startsWith("devglow-") ? DEVGLOW_PRESETS[full.slice(8)] : PRESETS[full]);

describe("one source for every preset: the quantized configuration", () => {
  test("preset configs are already normalized (what the code can hold)", () => {
    for (const [full, short] of ALL) { const c = configOf(full, short); expect(normalizeConfig(c)).toEqual(c); }
  });
  test("PRESETS / DEVGLOW_PRESETS are exactly the configuration's options", () => {
    for (const [full, short] of ALL) expect(optionsOf(full)).toEqual(configToThemeOptions(configOf(full, short)));
  });
  test("CSS of the preset == CSS built from decodeCode(its code), byte for byte, for all 24", () => {
    for (const [full, short] of ALL) {
      const code = encodeConfig(configOf(full, short));
      expect([full, toCss(buildTheme(configToThemeOptions(decodeCode(code).config)))]).toEqual([full, toCss(buildTheme(optionsOf(full)))]);
    }
  });
  test("registry item and DTCG come from the same theme", () => {
    const { items } = buildRegistry();
    for (const [full, short] of ALL) {
      const theme = buildTheme(configToThemeOptions(decodeCode(encodeConfig(configOf(full, short))).config));
      const item = items.find((i) => i.name === `theme-${full}`)!;
      const dtcg = toDtcg(theme) as { light: Record<string, { $value: { hex: string } }> };
      expect(item.meta.gennex.code).toBe(encodeConfig(configOf(full, short)));
      for (const k of Object.keys(theme.light)) expect(dtcg.light[k].$value.hex).toBe(theme.light[k]);
      expect(Object.keys(item.cssVars.light).length).toBe(Object.keys(theme.light).length);
    }
  });
});
