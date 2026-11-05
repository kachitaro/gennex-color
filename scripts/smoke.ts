// Smoke test of the BUILT output (dist/), not src/. Run: bun run smoke
import { readFileSync } from "node:fs";
import { CORE_HUES, DEVGLOW_PRESETS, PRESETS, buildTheme, configToThemeOptions, decodeCode, generateScale, nameOfHue, toCss, toDtcg } from "../dist/index.mjs";
import { generateScale as fromSrc } from "../src/scale";
import { toCss as cssFromSrc } from "../src/css";
import { buildTheme as themeFromSrc } from "../src/theme";

const s = generateScale({ hue: 255, mode: "light" });
if (s.hex.length !== 12 || !/^#[0-9a-f]{6}$/.test(s.foreground)) throw new Error("bad shape from dist");
if (JSON.stringify(s) !== JSON.stringify(fromSrc({ hue: 255, mode: "light" }))) throw new Error("dist differs from src");
if (CORE_HUES.length !== 12 || nameOfHue(40).name !== "coral") throw new Error("hues/names missing");

// Every preset has ONE source (its configuration): the static CSS, the DTCG file and the registry item must equal what the
// share code of that preset decodes to, byte for byte.
const ALL = { ...PRESETS, ...Object.fromEntries(Object.entries(DEVGLOW_PRESETS).map(([n, o]) => [`devglow-${n}`, o])) };
for (const name of Object.keys(ALL)) {
  const item = JSON.parse(readFileSync(`dist/r/theme-${name}.json`, "utf8"));
  const theme = buildTheme(configToThemeOptions(decodeCode(item.meta.gennex.code).config));
  if (readFileSync(`dist/css/${name}.css`, "utf8") !== toCss(theme)) throw new Error(`dist/css/${name}.css differs from decodeCode(${item.meta.gennex.code})`);
  const json = JSON.parse(readFileSync(`dist/tokens/${name}.tokens.json`, "utf8"));
  if (JSON.stringify(json) !== JSON.stringify(toDtcg(theme, { description: `gennex-color preset: ${name}` }))) throw new Error(`dist/tokens/${name} differs from its code`);
  for (const k of Object.keys(theme.light)) if (json.light[k].$value.hex !== theme.light[k]) throw new Error(`${name}: ${k}`);
}
console.log("dist smoke ok:", s.hex.join(" "), "| presets", Object.keys(ALL).length);
