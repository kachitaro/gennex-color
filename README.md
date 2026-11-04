# gennex-color

A color system that pairs Radix-style 12-step scales with shadcn/ui semantic tokens. Every text/surface pair of the shadcn
token set (and of the shadcn `radix-nova` components, including their translucent forms) is checked against WCAG 2.x in
tests, for light and dark, for any brand hue 0-360.

Status: not published. Design and measurements: [`docs/SPEC.md`](docs/SPEC.md). Live preview: `docs/preview/theme.html`.

## Use the prebuilt CSS (Tailwind v4 + shadcn)

```css
@import "tailwindcss";
@import "gennex-color/css/blue.css"; /* :root, .dark and @theme inline; presets: red ... pink */
@custom-variant dark (&:is(.dark *));
```

Presets are named after the 12 core hues. Design tokens (DTCG, with hex): `gennex-color/tokens/blue.tokens.json`.

## Use it from code

```ts
import { buildTheme, toCss, toDtcg, nameOfHue } from "gennex-color";

const theme = buildTheme({ hue: 40, neutral: "warm" }); // any hue, e.g. coral 40
toCss(theme);   // :root + .dark + @theme inline
toDtcg(theme);  // { light, dark }, each token { $type: "color", $value: { colorSpace, components, hex } }
nameOfHue(40);  // { name: "coral", kind: "sub", core: "orange", offset: -12 }
```

`buildTheme` options: `hue`, `kappa` (0.35-0.85), `neutral` (`"neutral" | "cool" | "warm" | "auto"` or `{ hue, chroma }`),
`status` (hue per `destructive | success | warning | info`), `pageStep` (`2` = page uses neutral step 2),
`primaryMode` (below).

## Change the theme at runtime

```ts
import { applyThemeToRoot, buildTheme } from "gennex-color";

slider.addEventListener("input", () => applyThemeToRoot(buildTheme({ hue: +slider.value, neutral: "auto" })));
```

Keeps one `<style data-gennex-theme-style>` in `<head>` and swaps only CSS variables (both light and dark, so toggling
`.dark` on `<html>` needs no second call): no layout shift, nothing else in the DOM changes, and applying the same theme
twice rewrites nothing. `applyThemeToRoot(theme, element)` scopes it to one element. `buildTheme` takes about 5 ms; coalesce
calls with `requestAnimationFrame` while dragging (see `examples/vite-app/src/components/theme-slider.tsx`).

## `primaryMode`: `accessible` (default) and `vivid`

shadcn components use `text-primary` as a text color in five places (`item`, `empty`, `field`, `badge` link, `button`
link; counted from the `radix-nova` registry of `shadcn@4.23.0`). A color that is readable as text on a white page has to be
dark, which for a bright brand (yellow, amber, lime, orange, green, teal, cyan) means a dark olive/brown button in light mode.

- `accessible`: `primary` itself reads as text everywhere. `primary-text` equals `primary`.
- `vivid`: `primary` stays as bright as its foreground duties allow (including `hover:bg-primary/80`), and the new token
  `primary-text` (>= 4.5:1 on background, card, popover, muted, sidebar) takes the text duty. Every contrast pair still
  passes except `text-primary` itself. Point those five components at `primary-text`:

```sh
perl -pi -e 's/text-primary(?![\w-])/text-primary-text/g' \
  src/components/ui/{item,empty,field,badge,button}.tsx   # only the ones you have installed
```

`primary-text` is exported to CSS as `--primary-text` / `--color-primary-text`, so `text-primary-text` is a Tailwind utility.

## Develop

```sh
bun test            # contrast gates, sweeps over every hue
bun run typecheck
bun run build       # dist/: ESM + .d.ts, css/<preset>.css, tokens/<preset>.tokens.json
bun run smoke       # built output
bun run smoke:example  # packs the tarball, builds examples/vite-app (Vite + Tailwind v4 + shadcn)
```
