// Regenerates test/codes.golden.json: frozen (code, config, sha256 of the CSS) triples for the current ENGINE_EPOCH.
// Only run this together with a bump of ENGINE_EPOCH (or when adding entries). Run: bun scripts/gen-golden.ts
import { createHash } from "node:crypto";
import { ENGINE_EPOCH, configToThemeOptions, encodeConfig, normalizeConfig, type ThemeConfig } from "../src/code";
import { devglowConfig, presetConfig } from "../src/configs";
import { toCss } from "../src/css";
import { CORE_HUES } from "../src/hues";
import { DEVGLOW_PRESETS } from "../src/devglow";
import { buildTheme } from "../src/theme";

const configs: ThemeConfig[] = [];
for (const c of CORE_HUES) configs.push(presetConfig(c.name));
for (const n of Object.keys(DEVGLOW_PRESETS)) configs.push(devglowConfig(n), devglowConfig(n, { darkChromaCap: 0.06 }));
const hues = [0, 25, 40, 64, 106, 217.5, 255, 292, 325, 355, 359.9];
for (const hue of hues) for (const kappa of [0.35, 0.6, 0.85]) for (const neutral of ["neutral", "cool", "warm", "auto"] as const) {
  configs.push(normalizeConfig({ hue, kappa, neutral, pageStep: 1, primaryMode: "accessible" }));
  configs.push(normalizeConfig({ hue, kappa, neutral, pageStep: 2, primaryMode: "vivid" }));
}
configs.push(
  normalizeConfig({ hue: 40, neutral: { hue: 70, chroma: 0.0125, canvasDark: 0.15 } }),
  normalizeConfig({ hue: 200, neutral: { hue: 252, chroma: 0.03, chromaDark: 0.06, canvasDark: 0.138 }, kappa: 0.4 }),
  normalizeConfig({ hue: 106, primaryMode: "vivid", status: { warning: 60, info: 200 } }),
  normalizeConfig({ hue: 333.3, kappa: 0.35, neutral: "auto", pageStep: 2, status: { destructive: 10, success: 140, warning: 70, info: 230 } }),
  normalizeConfig({ hue: 0 }),
);
const seen = new Set<string>(), entries = [];
for (const config of configs) {
  const code = encodeConfig(config);
  if (seen.has(code)) continue;
  seen.add(code);
  entries.push({ code, config, themeHash: createHash("sha256").update(toCss(buildTheme(configToThemeOptions(config)))).digest("hex") });
}
await Bun.write("test/codes.golden.json", JSON.stringify({ epoch: ENGINE_EPOCH, entries }, null, 1) + "\n");
console.log("golden entries:", entries.length);
