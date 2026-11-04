import { TOKEN_NAMES, type Theme, type TokenMap } from "./theme";

const group = (t: TokenMap) =>
  Object.fromEntries(TOKEN_NAMES.map((k) => {
    const n = parseInt(t[k].slice(1), 16);
    const components = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(6));
    return [k, { $type: "color", $value: { colorSpace: "srgb", components, hex: t[k] } }];
  }));

/**
 * Design Tokens Community Group color tokens (module 2025.10): `$value = { colorSpace, components, hex }`.
 * Two groups, `light` and `dark`, each holding every token. sRGB components are 0-1.
 */
export function toDtcg(theme: Theme, { description = "gennex-color theme" }: { description?: string } = {}) {
  return { $description: description, light: group(theme.light), dark: group(theme.dark) };
}
