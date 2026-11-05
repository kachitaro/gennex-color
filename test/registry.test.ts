import { describe, expect, test } from "bun:test";
import { decodeCode, configToThemeOptions, normalizeConfig } from "../src/code";
import { devglowConfig } from "../src/devglow";
import { presetConfig } from "../src/presets";
import { toOklchCss, toCss } from "../src/css";
import { SHADCN_TOKENS, buildRegistry, toRegistryItem } from "../src/registry";
import { TOKEN_NAMES, buildTheme } from "../src/theme";

const config = normalizeConfig({ hue: 40, neutral: "warm", primaryMode: "vivid" });
const theme = buildTheme(configToThemeOptions(config));
const item = toRegistryItem(theme, { name: "theme-coral", title: "coral", description: "coral warm vivid", config });

describe("toRegistryItem", () => {
  test("is a registry:theme item with the schema url", () => {
    expect(item.$schema).toBe("https://ui.shadcn.com/schema/registry-item.json");
    expect(item.type).toBe("registry:theme");
    expect(item.name).toBe("theme-coral");
  });
  test("31 shadcn tokens + 21 extensions = every token; each mode lists all, as oklch(), equal to toCss", () => {
    expect(SHADCN_TOKENS).toHaveLength(31);
    expect(TOKEN_NAMES.length - SHADCN_TOKENS.length).toBe(21);
    for (const m of ["light", "dark"] as const) {
      expect(Object.keys(item.cssVars[m])).toEqual([...TOKEN_NAMES]);
      for (const k of TOKEN_NAMES) expect(item.cssVars[m][k]).toBe(toOklchCss(theme[m][k]));
    }
    const css = toCss(theme);
    for (const k of TOKEN_NAMES) expect(css).toContain(`--${k}: ${item.cssVars.light[k]};`);
  });
  test("cssVars.theme maps exactly the 21 extension tokens to --color-*, nothing else (E2: no radius)", () => {
    const ext = TOKEN_NAMES.filter((k) => !SHADCN_TOKENS.includes(k));
    expect(item.cssVars.theme).toEqual(Object.fromEntries(ext.map((k) => [`color-${k}`, `var(--${k})`])));
    for (const m of ["light", "dark", "theme"] as const) expect(Object.keys(item.cssVars[m]).join()).not.toMatch(/radius|font/);
  });
  test("meta carries the share code and epoch; the code reproduces the very same CSS", () => {
    const g = item.meta.gennex as { code: string; epoch: number };
    expect(decodeCode(g.code).config).toEqual(config);
    expect(g.epoch).toBe(1);
    expect(toCss(buildTheme(configToThemeOptions(decodeCode(g.code).config)))).toBe(toCss(theme));
  });
  test("without a config there is no meta code (arbitrary Theme objects are allowed)", () => {
    const x = toRegistryItem(theme, { name: "t", title: "t", description: "d" });
    expect(x.meta?.gennex?.code).toBeUndefined();
  });
});

describe("buildRegistry (24 preset items)", () => {
  const r = buildRegistry();
  test("24 uniquely named items, theme-<preset>, devglow ones prefixed", () => {
    expect(r.items).toHaveLength(24);
    const names = r.items.map((i) => i.name);
    expect(new Set(names).size).toBe(24);
    expect(names).toContain("theme-blue");
    expect(names).toContain("theme-devglow-ember");
  });
  test("registry.json lists the same items and has the registry schema", () => {
    expect(r.registry.$schema).toBe("https://ui.shadcn.com/schema/registry.json");
    expect(r.registry.items).toEqual(r.items);
    expect(r.registry.name).toBe("gennex-color");
  });
  test("each item's code decodes to the preset's config; items are deterministic bytes", () => {
    for (const i of r.items) { const c = decodeCode(i.meta.gennex.code!).config; expect(c.hue).toBeGreaterThanOrEqual(0); }
    expect(decodeCode(r.items.find((i) => i.name === "theme-blue")!.meta.gennex.code!).config).toEqual(presetConfig("blue"));
    expect(decodeCode(r.items.find((i) => i.name === "theme-devglow-ember")!.meta.gennex.code!).config).toEqual(devglowConfig("ember"));
    expect(JSON.stringify(buildRegistry())).toBe(JSON.stringify(r));
  });
});
