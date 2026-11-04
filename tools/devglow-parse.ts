export const KEYS = ["FOREGROUND", "BACKGROUND", "RED", "GREEN", "BLUE", "ORANGE", "YELLOW", "PINK", "GOLD", "TEAL", "SKY", "WINE", "DARK_00", "DARK_01", "DARK_02", "DARK_03", "DARK_04"] as const;
export type Palette = Record<(typeof KEYS)[number], string>;

/** Reads the 17 `KEY = "#rrggbb"` lines of a devglow palette file. Throws if one is missing or malformed. */
export function parseLuaPalette(lua: string): Palette {
  const out = {} as Palette;
  for (const k of KEYS) {
    const m = lua.match(new RegExp(`^\\s*${k}\\s*=\\s*"(#[0-9A-Fa-f]{6})"`, "m"));
    if (!m) throw new Error(`devglow palette: key ${k} is missing or not a #rrggbb color`);
    out[k] = m[1].toLowerCase();
  }
  return out;
}

/** `### Sage — *one for the quiet night*` -> { sage: "one for the quiet night" } */
export function parseTaglines(readme: string): Record<string, string> {
  return Object.fromEntries([...readme.matchAll(/^### (\w+) — \*(.+)\*$/gm)].map((m) => [m[1].toLowerCase(), m[2]]));
}
