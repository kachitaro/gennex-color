import { toRuntimeCss } from "./css";
import type { Theme } from "./theme";

let scopes = 0;

/**
 * Applies a theme at runtime (theme slider, per-user brand color): replaces the CSS variables of `element` (default the
 * document root). Both modes are written, so toggling `.dark` needs no second call.
 *
 * It maintains a single `<style data-gennex-theme-style>` in `<head>` and only swaps its text, so only custom properties
 * change: no node is added to the page, no attribute of the root element is touched, and re-applying the same theme
 * rewrites nothing. The static stylesheet (`gennex-color/css/*.css`) still provides `@theme inline` and the defaults.
 *
 * - Root: rules `:root:root` (light) and `:root.dark` (dark). They out-rank the static `:root` / `.dark` rules whatever
 *   the stylesheet order. `.dark` must be on `<html>`, as in shadcn.
 * - Other element: it gets a `data-gennex-theme` scope attribute; dark applies when it or an ancestor has `.dark`.
 */
export function applyThemeToRoot(theme: Theme, element?: Element): void {
  const doc = element?.ownerDocument ?? (globalThis as { document?: Document }).document;
  if (!doc) throw new Error("applyThemeToRoot needs a DOM: pass an element or run in a browser");
  const root = element ?? doc.documentElement;
  let key: string, css: string;
  if (root === doc.documentElement) {
    key = "root";
    css = toRuntimeCss(theme, { light: ":root:root", dark: ":root.dark" });
  } else {
    key = root.getAttribute("data-gennex-theme") ?? String(++scopes);
    root.setAttribute("data-gennex-theme", key);
    const s = `[data-gennex-theme="${key}"]`;
    css = toRuntimeCss(theme, { light: s, dark: `.dark ${s}, ${s}.dark` });
  }
  let style = doc.head.querySelector(`style[data-gennex-theme-style="${key}"]`);
  if (!style) {
    style = doc.createElement("style");
    style.setAttribute("data-gennex-theme-style", key);
    doc.head.append(style);
  }
  if (style.textContent !== css) style.textContent = css;
}
