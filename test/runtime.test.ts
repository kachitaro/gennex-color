import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { toOklchCss } from "../src/css";
import { applyThemeToRoot } from "../src/runtime";
import { TOKEN_NAMES, buildTheme } from "../src/theme";

const wins: Window[] = [];
const fresh = () => { const w = new Window(); wins.push(w); return w; };
afterEach(async () => { for (const w of wins.splice(0)) await w.happyDOM.close(); });

const styles = (doc: Document) => [...doc.head.querySelectorAll("style[data-gennex-theme-style]")] as HTMLStyleElement[];
const blue = buildTheme({ hue: 255 }), coral = buildTheme({ hue: 40, neutral: "warm" });

describe("applyThemeToRoot", () => {
  test("writes every token of both modes as oklch() into one <style> in <head>", () => {
    const w = fresh(), doc = w.document as unknown as Document;
    applyThemeToRoot(blue, doc.documentElement);
    const [s] = styles(doc);
    expect(styles(doc)).toHaveLength(1);
    const css = s.textContent!;
    expect(css).not.toContain("@theme"); // the static stylesheet owns the Tailwind mapping
    for (const [sel, mode] of [[":root:root", "light"], [":root.dark", "dark"]] as const) {
      const block = css.slice(css.indexOf(sel + " {"), css.indexOf("}", css.indexOf(sel + " {")));
      expect(block).toContain(sel);
      for (const k of TOKEN_NAMES) expect(block).toContain(`--${k}: ${toOklchCss(blue[mode][k])};`);
    }
  });

  test("computed variables follow the theme and the .dark class (light and dark both applied, no re-apply on toggle)", () => {
    const w = fresh(), doc = w.document as unknown as Document, root = doc.documentElement;
    applyThemeToRoot(coral, root);
    const get = (k: string) => (w.getComputedStyle(root as any) as any).getPropertyValue(`--${k}`).trim();
    expect(get("primary")).toBe(toOklchCss(coral.light.primary));
    root.classList.add("dark");
    expect(get("primary")).toBe(toOklchCss(coral.dark.primary));
    expect(get("background")).toBe(toOklchCss(coral.dark.background));
    root.classList.remove("dark");
    expect(get("background")).toBe(toOklchCss(coral.light.background));
  });

  test("updating replaces the rules: still one <style>, content is the latest theme only", () => {
    const w = fresh(), doc = w.document as unknown as Document;
    for (const t of [blue, coral, blue, coral]) applyThemeToRoot(t, doc.documentElement);
    expect(styles(doc)).toHaveLength(1);
    expect(styles(doc)[0].textContent).toContain(toOklchCss(coral.light.primary));
    expect(styles(doc)[0].textContent).not.toContain(`--primary: ${toOklchCss(blue.light.primary)};`);
  });

  test("no layout shift: nothing in <body> or on the root element changes; re-applying an identical theme touches no DOM node", () => {
    const w = fresh(), doc = w.document as unknown as Document, root = doc.documentElement;
    doc.body.innerHTML = '<main id="a"><button>Primary</button></main>';
    root.classList.add("dark");
    const before = { body: doc.body.innerHTML, cls: root.className, style: root.getAttribute("style"), attrs: root.getAttributeNames().sort().join() };
    applyThemeToRoot(blue, root);
    const style = styles(doc)[0], text = style.firstChild;
    applyThemeToRoot(blue, root);
    expect(styles(doc)[0]).toBe(style);
    expect(style.firstChild).toBe(text); // same text node: nothing was rewritten, so no style recalculation
    applyThemeToRoot(coral, root);
    expect({ body: doc.body.innerHTML, cls: root.className, style: root.getAttribute("style"), attrs: root.getAttributeNames().sort().join() }).toEqual(before);
    expect(doc.head.querySelectorAll("style")).toHaveLength(1);
  });

  test("scoped to an element: that element gets its own scope attribute and style, :root stays untouched", () => {
    const w = fresh(), doc = w.document as unknown as Document;
    doc.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    const [a, b] = [doc.getElementById("a")!, doc.getElementById("b")!];
    applyThemeToRoot(blue, a);
    applyThemeToRoot(coral, b);
    expect(styles(doc)).toHaveLength(2);
    expect(a.getAttribute("data-gennex-theme")).not.toBe(b.getAttribute("data-gennex-theme"));
    const get = (el: Element, k: string) => (w.getComputedStyle(el as any) as any).getPropertyValue(`--${k}`).trim();
    expect(get(a, "primary")).toBe(toOklchCss(blue.light.primary));
    expect(get(b, "primary")).toBe(toOklchCss(coral.light.primary));
    expect(get(doc.documentElement, "primary")).toBe("");
    // dark applies to the scope when it or an ancestor has .dark
    b.classList.add("dark");
    expect(get(b, "primary")).toBe(toOklchCss(coral.dark.primary));
    doc.body.classList.add("dark");
    expect(get(a, "primary")).toBe(toOklchCss(blue.dark.primary));
    // re-applying to the same element reuses its style
    applyThemeToRoot(coral, a);
    expect(styles(doc)).toHaveLength(2);
    expect(get(a, "primary")).toBe(toOklchCss(coral.dark.primary));
  });

  test("defaults to the global document's root element", () => {
    const w = fresh(), g = globalThis as { document?: unknown };
    const prev = g.document;
    g.document = w.document;
    try {
      applyThemeToRoot(blue);
      expect(styles(w.document as unknown as Document)).toHaveLength(1);
    } finally { g.document = prev; }
  });

  test("without any DOM it fails loudly instead of silently doing nothing", () => {
    expect(() => applyThemeToRoot(blue)).toThrow(/DOM/);
  });

  test("a slider sweep: 90 hues in a row keep exactly one <style>", () => {
    const w = fresh(), doc = w.document as unknown as Document;
    for (let h = 0; h < 360; h += 4) applyThemeToRoot(buildTheme({ hue: h, neutral: "auto" }), doc.documentElement);
    expect(styles(doc)).toHaveLength(1);
  });
});
