# gennex-color

`gennex-color@0.1.0`: a color system that pairs Radix-style 12-step scales with shadcn/ui semantic tokens. For any brand hue
(0-360), light and dark, every text/surface pair of the shadcn token set and of the shadcn `radix-nova` components
(including their translucent forms such as `bg-destructive/10` or `hover:bg-primary/80`) is checked against WCAG 2.x in tests.

Status: **not published to npm**. Design, measurements and decisions: [`docs/SPEC.md`](docs/SPEC.md). Live preview:
`docs/preview/theme.html` (open the file in a browser).

## Install

Not on npm yet. Build a tarball and install that (dependencies come with it; `culori` is the only one):

```sh
bun install && bun run build && bun pm pack     # creates gennex-color-0.1.0.tgz
npm install ./gennex-color-0.1.0.tgz            # or: bun add ./gennex-color-0.1.0.tgz
```

Tested with Node 22 and Bun 1.4 (ESM only). `bun run smoke:clean` proves it from an empty directory.

## Use a preset (Tailwind v4 + shadcn)

```css
@import "tailwindcss";
@import "gennex-color/css/blue.css";   /* :root, .dark and @theme inline */
@custom-variant dark (&:is(.dark *));
```

Presets are named after the 12 core hues: `red orange amber yellow lime green teal cyan blue violet magenta pink`.
There are also 12 presets derived from the palettes of [devglow](https://github.com/phatnt199/devglow) (MIT, see `NOTICE`):
`devglow-sage devglow-ember devglow-blush devglow-amber devglow-dusk devglow-vesper devglow-moss devglow-tide devglow-mocha
devglow-plum devglow-ash devglow-nocturne`: a hand-picked brand hue per mood, the neutral ramp and page darkness measured from
the palette. In code: `DEVGLOW_PRESETS`. Refresh them with `bun tools/sync-devglow.ts --ref <commit>`.
The file defines every token below as `oklch()` variables (names match shadcn's), a `.dark` block, and `@theme inline`
so `bg-primary`, `text-muted-foreground`, `border-input`, `ring-ring`... work. Toggle dark mode with `.dark` on `<html>`.
Design tokens for other tools (Figma, Style Dictionary): `gennex-color/tokens/blue.tokens.json` (DTCG 2025.10 color
module, sRGB components plus hex).

`examples/vite-app` is a working Vite + Tailwind v4 + shadcn app (`bun run smoke:example` builds it from the real tarball).

## Build any theme from code

```ts
import { buildTheme, toCss, toDtcg, nameOfHue } from "gennex-color";

const theme = buildTheme({ hue: 40, neutral: "warm" }); // any hue 0-360, not just the presets
theme.light.primary;   // "#973e1c"  (every value is an sRGB hex)
toCss(theme);          // :root + .dark + @theme inline, ready to save as a .css file
toDtcg(theme);         // { light, dark }, each token { $type: "color", $value: { colorSpace, components, hex } }
nameOfHue(40);         // { name: "coral", kind: "sub", core: "orange", offset: -12 }
```

| Option | Values | Default |
|---|---|---|
| `hue` | brand seed, 0-360 | required |
| `kappa` | brand chroma, 0.35-0.85 | 0.85 |
| `neutral` | `"neutral"`, `"cool"`, `"warm"`, `"auto"` (follows the brand hue) or `{ hue, chroma }` | `"neutral"` |
| `status` | hue per `destructive`, `success`, `warning`, `info` | red 25, green 156, amber 80, blue 255 |
| `pageStep` | `2` = page uses neutral step 2, card is lighter (light) / one step up (dark) | `1` |
| `primaryMode` | `"accessible"` or `"vivid"` (below) | `"accessible"` |

Lower-level pieces: `generateScale({ hue, mode })` (12 steps + foreground), `generateNeutral`, `neutralAlpha`, `neutralBorder`.

## Change the theme at runtime

```ts
import { applyThemeToRoot, buildTheme } from "gennex-color";

slider.addEventListener("input", () => applyThemeToRoot(buildTheme({ hue: +slider.value, neutral: "auto" })));
```

Keeps one `<style data-gennex-theme-style>` in `<head>` and swaps only CSS variables, for both light and dark (toggling
`.dark` on `<html>` needs no second call): no layout shift, nothing else in the DOM changes, and applying the same theme
twice rewrites nothing. `applyThemeToRoot(theme, element)` scopes it to one element. Cost: `buildTheme` is about 5 ms in Bun
and 8-10 ms of total update time in Chrome; on a CPU throttled 4x it is about 38 ms, so coalesce calls with
`requestAnimationFrame` while dragging (see `examples/vite-app/src/components/theme-slider.tsx` and SPEC 12.4 for measurements
and how to make it faster).

## `primaryMode`: `accessible` (default) and `vivid`

shadcn components use `text-primary` as a text color in five places: `item`, `empty`, `field`, `badge` (link variant) and
`button` (link variant) (counted from the `radix-nova` registry of `shadcn@4.23.0`). A color that reads as text on a white page
must be dark, which for a bright brand (yellow, amber, lime, orange, green, teal, cyan) means a dark olive or brown button in
light mode.

- `accessible`: `primary` itself reads as text everywhere. `primary-text` equals `primary`.
- `vivid`: `primary` stays as bright as its foreground duties allow (including `hover:bg-primary/80`), and the token
  `primary-text` (>= 4.5:1 on background, card, popover, muted, sidebar) takes the text duty. Every contrast pair still passes
  except `text-primary` itself. Point those five components at `primary-text`:

```sh
perl -pi -e 's/text-primary(?![\w-])/text-primary-text/g' \
  src/components/ui/{item,empty,field,badge,button}.tsx   # only the ones you have installed
```

`primary-text` is exported as `--primary-text` / `--color-primary-text`, so `text-primary-text` is a Tailwind utility. The lookahead
leaves `text-primary-foreground` alone. In vivid mode the brand only gets brighter where the foreground allows it: bright hues in
light and dark hues in dark; red, blue, violet, magenta and pink stay dark in light mode because their white text on
`hover:bg-primary/80` needs it.

Not covered by any theme: shadcn's own translucent text `text-foreground/60` (inactive tabs, about 4.1:1) and
`text-muted-foreground/70` (trace timestamps, about 3.0:1). They are component choices, not token values.

## Tokens

Every theme has these 52 tokens in `light` and in `dark`. "shadcn" tokens are the names in the shadcn theming docs; the
others are extensions (the CSS file maps them to `--color-*` the same way).

| Token | Origin | Role | Source |
|---|---|---|---|
| `background` | shadcn | Page background | neutral step 1 (step 2 with `pageStep: 2`) |
| `foreground` | shadcn | Default text | neutral step 12 |
| `card` | shadcn | Card surface | step 1 light / step 2 dark |
| `card-foreground` | shadcn | Text on card | step 12 |
| `popover` | shadcn | Popover, menu surface | same as card |
| `popover-foreground` | shadcn | Text on popover | step 12 |
| `primary` | shadcn | Solid brand color, also `text-primary` | brand step 9, moved darker (light) / lighter (dark) only as far as needed to read as text; `vivid` keeps it as bright as allowed |
| `primary-foreground` | shadcn | Text on primary (also on hover and `primary/80`) | solved per hue, >= 4.5:1 |
| `primary-hover` | extension | Hover fill of primary | next step / 0.03 L away from the pivot |
| `primary-text` | extension | Brand color used as text | `accessible`: equals `primary`. `vivid`: brightest brand color that reads as text (>= 4.5:1) |
| `secondary` | shadcn | Low-emphasis fill | neutral step 3 |
| `secondary-foreground` | shadcn | Text on secondary | step 12 |
| `muted` | shadcn | Subtle surface | neutral step 3 |
| `muted-foreground` | shadcn | Secondary text | neutral step 11 (>= 4.5:1 on every surface) |
| `accent` | shadcn | Hover, selected surface | neutral step 4 |
| `accent-foreground` | shadcn | Text on accent | step 12 |
| `border` | shadcn | Decorative border | neutral step 6 |
| `input` | shadcn | Form control border | solved: lightest neutral still >= 3:1 on its surfaces (WCAG 1.4.11) |
| `ring` | shadcn | Focus ring | first brand step 9-12 that is >= 3:1 on background, card and sidebar |
| `chart-1` | shadcn | Chart series | core hues >= 22 deg from the brand, each >= 3:1 on card, picked for maximum spread |
| `chart-2` | shadcn | Chart series | core hues >= 22 deg from the brand, each >= 3:1 on card, picked for maximum spread |
| `chart-3` | shadcn | Chart series | core hues >= 22 deg from the brand, each >= 3:1 on card, picked for maximum spread |
| `chart-4` | shadcn | Chart series | core hues >= 22 deg from the brand, each >= 3:1 on card, picked for maximum spread |
| `chart-5` | shadcn | Chart series | core hues >= 22 deg from the brand, each >= 3:1 on card, picked for maximum spread |
| `sidebar` | shadcn | Sidebar surface | neutral step 2 |
| `sidebar-foreground` | shadcn | Sidebar text | step 12 |
| `sidebar-primary` | shadcn | Sidebar emphasis | same as primary |
| `sidebar-primary-foreground` | shadcn | Text on sidebar-primary | same as primary-foreground |
| `sidebar-accent` | shadcn | Sidebar hover, selected | neutral step 4 |
| `sidebar-accent-foreground` | shadcn | Text on sidebar-accent | step 12 |
| `sidebar-border` | shadcn | Sidebar border | neutral step 6 |
| `sidebar-ring` | shadcn | Sidebar focus ring | same as ring |
| `destructive` | shadcn | Destructive actions, error text | red step 9, moved as needed to read as text and on its own `/10-/30` tints |
| `destructive-foreground` | extension | destructive text on the solid | solved per hue |
| `destructive-subtle` | extension | destructive tinted background | step 3 |
| `destructive-text` | extension | destructive text color | step 11 |
| `destructive-border` | extension | destructive border | step 7 |
| `success` | extension | success solid | step 9 |
| `success-foreground` | extension | success text on the solid | solved per hue |
| `success-subtle` | extension | success tinted background | step 3 |
| `success-text` | extension | success text color | step 11 |
| `success-border` | extension | success border | step 7 |
| `warning` | extension | warning solid | step 9 |
| `warning-foreground` | extension | warning text on the solid | solved per hue |
| `warning-subtle` | extension | warning tinted background | step 3 |
| `warning-text` | extension | warning text color | step 11 |
| `warning-border` | extension | warning border | step 7 |
| `info` | extension | info solid | step 9 |
| `info-foreground` | extension | info text on the solid | solved per hue |
| `info-subtle` | extension | info tinted background | step 3 |
| `info-text` | extension | info text color | step 11 |
| `info-border` | extension | info border | step 7 |

"Step N" is the Radix-style step of the neutral ramp or of the brand scale (1 background ... 9 solid ... 11 low-contrast text,
12 high-contrast text).

## Develop

```sh
bun test               # contrast gates, sweeps over every hue, runtime theming in a fake DOM
bun run typecheck
bun run build          # dist/: ESM + .d.ts, css/<preset>.css, tokens/<preset>.tokens.json
bun run smoke          # built output
bun run smoke:clean    # empty dir, only the tarball, npm/bun x node/bun
bun run smoke:example  # packs the tarball, builds examples/vite-app
bun run perf:example   # slider cost in headless Chrome, 1x and 4x CPU
```

No license has been chosen yet (needed before publishing).
