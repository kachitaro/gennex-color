import { ENGINE_EPOCH, encodeConfig, type ThemeConfig } from "./code";
import { devglowConfig } from "./devglow";
import { presetConfig } from "./presets";
import { toOklchCss } from "./css";
import { DEVGLOW_PRESETS } from "./devglow";
import { PRESETS } from "./presets";
import { TOKEN_NAMES, buildTheme, type Theme } from "./theme";
import { configToThemeOptions } from "./code";

/** The token names that shadcn's own `@theme inline` already maps (docs/SPEC.md 3.3); everything else needs `cssVars.theme`. */
export const SHADCN_TOKENS: readonly string[] = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground", "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
];

export interface RegistryItem {
  $schema: "https://ui.shadcn.com/schema/registry-item.json";
  name: string;
  type: "registry:theme";
  title: string;
  description: string;
  cssVars: { theme: Record<string, string>; light: Record<string, string>; dark: Record<string, string> };
  meta: { gennex: { code?: string; epoch: number } };
}

/**
 * A shadcn `registry:theme` item: colors only (no `--radius`, which would make `shadcn add` also write the radius scale and
 * override the project's). Install: `npx shadcn@latest add <url|file>`.
 */
export function toRegistryItem(theme: Theme, o: { name: string; title: string; description: string; config?: ThemeConfig }): RegistryItem {
  const mode = (m: "light" | "dark") => Object.fromEntries(TOKEN_NAMES.map((k) => [k, toOklchCss(theme[m][k])]));
  const ext = TOKEN_NAMES.filter((k) => !SHADCN_TOKENS.includes(k));
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: o.name,
    type: "registry:theme",
    title: o.title,
    description: o.description,
    cssVars: { theme: Object.fromEntries(ext.map((k) => [`color-${k}`, `var(--${k})`])), light: mode("light"), dark: mode("dark") },
    meta: { gennex: { ...(o.config && { code: encodeConfig(o.config) }), epoch: ENGINE_EPOCH } },
  };
}

/** The 24 preset items (12 core hues, 12 devglow) and the `registry.json` that lists them. */
export function buildRegistry() {
  const entries: { name: string; title: string; description: string; config: ThemeConfig }[] = [
    ...Object.keys(PRESETS).map((n) => ({ name: `theme-${n}`, title: n, description: `gennex-color preset ${n}`, config: presetConfig(n) })),
    ...Object.keys(DEVGLOW_PRESETS).map((n) => ({ name: `theme-devglow-${n}`, title: `devglow ${n}`, description: `gennex-color preset derived from devglow ${n}`, config: devglowConfig(n) })),
  ];
  const items = entries.map((e) => toRegistryItem(buildTheme(configToThemeOptions(e.config)), e));
  return {
    items,
    registry: { $schema: "https://ui.shadcn.com/schema/registry.json" as const, name: "gennex-color", homepage: "https://github.com/kachitaro/gennex-color", items },
  };
}
