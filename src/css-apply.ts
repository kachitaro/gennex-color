import postcss from "postcss";
import { toOklchCss } from "./css";
import { SHADCN_TOKENS } from "./registry";
import { TOKEN_NAMES, type Theme } from "./theme";

type Rule = postcss.Rule;
type AtRule = postcss.AtRule;
type Decl = postcss.Declaration;
type Node = postcss.ChildNode;
type Container = Rule | AtRule;

/** `exit` is the CLI exit code: 2 = bad input / could not do it safely, 3 = project not supported. */
export class ApplyError extends Error {
  constructor(public exit: 2 | 3, message: string) {
    super(message);
    this.name = "ApplyError";
  }
}

/**
 * W1 a rule we do not edit that targets the page root (`html:root`, `:root.x`, `:root` inside `@media`) sets one of our variables and can win;
 * W2 another page-level rule (`.theme`, `[data-theme]`, `body`, `*`) does;
 * W3 an unlayered rule beats ours because ours sit in an `@layer`;
 * W4 `--color-<token>` in `@theme` points somewhere else (skipped unless `force`);
 * W5 the prebuilt stylesheet is imported (only reached with `force`).
 */
export interface Finding { code: "W1" | "W2" | "W3" | "W4" | "W5"; message: string; line?: number; selector?: string; token?: string }
export interface ApplyOptions {
  tokens?: "all" | "shadcn";
  /** text of the marker comment, or null for none */
  marker?: string | null;
  force?: boolean;
}
export interface ApplyResult {
  text: string;
  changed: boolean;
  stats: { updated: number; inserted: number; mapped: number; blocks: number };
  findings: Finding[];
}

const MARKER_RE = /\/\*\s*gennex-color (\S+) · (\S+)\s*\*\//;
export function readMarker(css: string): { version: string; code: string } | undefined {
  const m = css.match(MARKER_RE);
  return m ? { version: m[1], code: m[2] } : undefined;
}

interface Edit { start: number; end: number; text: string; seq: number }
interface DeclInfo { decl: Decl; token: string; rule: Rule; own: "light" | "dark" | null; layered: boolean }
interface OwnRule { rule: Rule; layered: boolean }
type Spec = [number, number, number];

const splitSelectors = (s: string) => {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
};
const norm = (s: string) => s.replace(/\s+/g, "").replace(/["']/g, "");

function specificity(sel: string): Spec {
  const s = sel.replace(/"[^"]*"|'[^']*'/g, "").replace(/:where\([^)]*\)/g, "");
  const a = (s.match(/#[\w-]+/g) ?? []).length;
  const c0 = (s.match(/::[\w-]+/g) ?? []).length;
  const b = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
  const types = s.replace(/::[\w-]+/g, "").split(/[\s>+~]+/).filter((p) => /^[a-zA-Z]/.test(p)).length;
  return [a, b, types + c0];
}
const cmp = (x: Spec, y: Spec) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

const PAGE_HTML = /^(:root|html|\[[^\]]+\]|\.[\w-]+)(\.[\w-]+|\[[^\]]+\]|:[\w-]+(\([^)]*\))?)*$/;
const PAGE_CONTENT = /^(body|\*|#(root|__next|app))(\.[\w-]+|\[[^\]]+\])*$/;

export function applyTheme(input: string, theme: Theme, o: ApplyOptions = {}): ApplyResult {
  const r = run(input, theme, o);
  if (r.changed) {
    const again = run(r.text, theme, o);
    if (again.changed) throw new ApplyError(2, "internal check failed: applying the result again would change the file once more; nothing was written");
  }
  return r;
}

function run(input: string, theme: Theme, o: ApplyOptions): ApplyResult {
  const force = o.force === true;
  const marker = o.marker === undefined ? null : o.marker;
  const OWN = new Set<string>(o.tokens === "shadcn" ? SHADCN_TOKENS : TOKEN_NAMES);
  const tokens = TOKEN_NAMES.filter((t) => OWN.has(t));
  const bom = input.charCodeAt(0) === 0xfeff;
  const css = bom ? input.slice(1) : input;
  const eol = css.indexOf("\n") > 0 && css[css.indexOf("\n") - 1] === "\r" ? "\r\n" : "\n";
  const line = (n: Node) => n.source?.start?.line;

  let root: postcss.Root;
  try { root = postcss.parse(css); } catch (e) { throw new ApplyError(2, `cannot parse the CSS: ${String((e as Error).message).split("\n")[0]}`); }

  // ---- compatibility --------------------------------------------------------------------------------------------------
  const findings: Finding[] = [];
  let darkSel: string[] = [".dark", "html.dark", ":root.dark"];
  root.walkAtRules((a) => {
    const name = a.name.toLowerCase();
    if (name === "tailwind") throw new ApplyError(3, `line ${line(a)}: @tailwind directives mean Tailwind v3; only Tailwind v4 is supported`);
    if (name === "import" && /gennex-color\/css\//.test(a.params)) {
      if (!force) throw new ApplyError(3, `line ${line(a)}: gennex-color's prebuilt stylesheet is already imported; change that import instead of applying over it (or use --force)`);
      findings.push({ code: "W5", line: line(a), message: "the prebuilt gennex-color stylesheet is imported too; its rules and the applied ones may disagree" });
    }
    if (name === "custom-variant" && /^dark\b/.test(a.params.trim())) {
      const m = a.params.match(/\.[A-Za-z_][\w-]*|\[[^\]]+\]/);
      if (!m) throw new ApplyError(3, `line ${line(a)}: this dark mode strategy is not supported (only a class or attribute selector)`);
      darkSel = [m[0], `html${m[0]}`, `:root${m[0]}`];
    }
  });
  const darkSet = new Set(darkSel.map(norm));
  const darkClass = darkSel[0];

  // ---- inventory ------------------------------------------------------------------------------------------------------
  const decls: DeclInfo[] = [];
  const own = { light: [] as OwnRule[], dark: [] as OwnRule[] };
  const themeBlocks: AtRule[] = [];
  const comments: postcss.Comment[] = [];
  const visit = (n: Node, layered: boolean, cond: boolean, nested: boolean) => {
    if (n.type === "comment") { comments.push(n); return; }
    if (n.type === "atrule") {
      const name = n.name.toLowerCase();
      if (!n.nodes || name === "keyframes" || name === "font-face" || name === "property") return;
      if (name === "theme") { themeBlocks.push(n); return; }
      if (name === "layer") { n.each((c) => visit(c, true, cond, nested)); return; }
      n.each((c) => visit(c, layered, true, nested));
      return;
    }
    if (n.type === "rule") {
      const sels = splitSelectors(n.selector).map((s) => s.trim());
      const isLight = sels.every((s) => s === ":root" || s === ":host") && sels.includes(":root");
      const isDark = sels.every((s) => darkSet.has(norm(s)));
      const mode = !cond && !nested ? (isLight ? "light" : isDark ? "dark" : null) : null;
      if (mode) own[mode].push({ rule: n, layered });
      n.each((c) => {
        if (c.type === "decl") {
          if (c.prop.startsWith("--") && OWN.has(c.prop.slice(2))) decls.push({ decl: c, token: c.prop.slice(2), rule: n, own: mode, layered });
        } else visit(c, layered, true, true);
      });
    }
  };
  root.each((n) => visit(n, false, false, false));

  // Tailwind v3 style values (`--background: 0 0% 100%`) cannot hold our oklch() colors
  for (const d of decls) if (/^-?[\d.]+\s+[\d.]+%\s+[\d.]+%$/.test(d.decl.value.trim())) throw new ApplyError(3, `line ${line(d.decl)}: --${d.token} holds an hsl triplet (Tailwind v3 theme); only Tailwind v4 is supported`);

  // ---- styles of the file ----------------------------------------------------------------------------------------------
  const indentOf = (c: Container): { multiline: boolean; indent: string } => {
    const ds = (c.nodes ?? []).filter((x) => x.type === "decl" || x.type === "comment");
    const withNl = [...ds].reverse().find((x) => (x.raws.before ?? "").includes("\n"));
    if (withNl) return { multiline: true, indent: (withNl.raws.before ?? "").split("\n").pop() ?? "" };
    if (ds.length > 0) return { multiline: false, indent: "" };
    const parentIndent = ((c.raws.before ?? "").split("\n").pop() ?? "").replace(/\S.*/, "");
    return { multiline: (c.raws.after ?? "").includes("\n"), indent: parentIndent + unit };
  };
  let unit = "  ";
  {
    const counts = new Map<string, number>();
    root.each((n) => { if (n.type === "rule" || n.type === "atrule") n.each((c) => { if (c.type === "decl" && (c.raws.before ?? "").includes("\n")) { const i = (c.raws.before ?? "").split("\n").pop()!; counts.set(i, (counts.get(i) ?? 0) + 1); } }); });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[0].length > 0) unit = top[0];
  }
  const betweenOf = (c: Container) => { const d = (c.nodes ?? []).find((x): x is Decl => x.type === "decl"); return d?.raws.between ?? ": "; };

  const edits: Edit[] = [];
  let seq = 0;
  const edit = (start: number, end: number, text: string) => edits.push({ start, end, text, seq: seq++ });
  const stats = { updated: 0, inserted: 0, mapped: 0, blocks: 0 };

  const insertLines = (c: Container, lines: string[]) => {
    const end = c.source!.end!.offset - 1;
    if (css[end] !== "}") throw new ApplyError(2, `unexpected CSS layout at line ${line(c)}; nothing was written`);
    let p = end;
    while (p > 0 && /\s/.test(css[p - 1])) p--;
    const prev = css[p - 1];
    const { multiline, indent } = indentOf(c);
    edit(p, p, (prev === ";" || prev === "{" ? "" : ";") + (multiline ? lines.map((l) => eol + indent + l).join("") : lines.join("")));
  };
  const openBrace = (c: Container) => {
    const i = css.indexOf("{", c.source!.start!.offset);
    if (i < 0) throw new ApplyError(2, `unexpected CSS layout at line ${line(c)}; nothing was written`);
    return i + 1;
  };

  // ---- values -----------------------------------------------------------------------------------------------------------
  const pending = new Map<Rule, string[]>();
  const newBlock: Record<"light" | "dark", string[]> = { light: [], dark: [] };
  const target = (m: "light" | "dark") => { const r = own[m].filter((x) => !x.layered).at(-1) ?? own[m].at(-1); return r?.rule; };
  for (const m of ["light", "dark"] as const) {
    for (const tok of tokens) {
      const want = toOklchCss(theme[m][tok]);
      const mine = decls.filter((d) => d.own === m && d.token === tok);
      if (mine.length > 0) {
        for (const d of mine) {
          const cur = d.decl.raws.value?.raw ?? d.decl.value;
          if (cur === want) continue;
          const vs = d.decl.source!.start!.offset + d.decl.prop.length + (d.decl.raws.between ?? ":").length;
          if (css.slice(vs, vs + cur.length) !== cur) throw new ApplyError(2, `unexpected CSS layout at line ${line(d.decl)}; nothing was written`);
          edit(vs, vs + cur.length, want);
          stats.updated++;
        }
      } else {
        const t = target(m);
        if (t) { pending.set(t, [...(pending.get(t) ?? []), `--${tok}${betweenOf(t)}${want};`]); stats.inserted++; }
        else { newBlock[m].push(`--${tok}: ${want};`); stats.inserted++; }
      }
    }
  }
  for (const [rule, lines] of pending) insertLines(rule, lines);

  // ---- marker -----------------------------------------------------------------------------------------------------------
  const markerText = marker === null ? null : `/* ${marker} */`;
  const oldMarker = comments.find((c) => /^\s*gennex-color \S+ · \S+\s*$/.test(c.text));
  let markerInNewBlock = false;
  if (markerText) {
    if (oldMarker) {
      const s = oldMarker.source!.start!.offset, e = oldMarker.source!.end!.offset;
      if (css.slice(s, e) !== markerText) edit(s, e, markerText);
    } else if (own.light[0]) {
      const r = own.light[0].rule, { multiline, indent } = indentOf(r);
      edit(openBrace(r), openBrace(r), multiline ? eol + indent + markerText : markerText);
    } else markerInNewBlock = true;
  }

  // ---- @theme inline: `--color-<token>: var(--<token>)` -------------------------------------------------------------------
  const mapDecls = new Map<string, Decl>();
  for (const b of themeBlocks) b.each((c) => { if (c.type === "decl" && c.prop.startsWith("--color-")) mapDecls.set(c.prop.slice(8), c); });
  const inline = themeBlocks.find((b) => /^\s*inline\s*$/.test(b.params));
  const missingMap: string[] = [];
  for (const tok of tokens) {
    const want = `var(--${tok})`, d = mapDecls.get(tok);
    if (!d) { missingMap.push(tok); continue; }
    if (d.value.replace(/\s+/g, "") === want) continue;
    if (!force) { findings.push({ code: "W4", token: tok, line: line(d), message: `--color-${tok} is ${d.value}, not ${want}: skipped (use --force to overwrite)` }); continue; }
    const vs = d.source!.start!.offset + d.prop.length + (d.raws.between ?? ":").length;
    edit(vs, vs + d.value.length, want);
    stats.mapped++;
  }
  if (missingMap.length > 0) {
    stats.mapped += missingMap.length;
    if (inline) insertLines(inline, missingMap.map((t) => `--color-${t}${betweenOf(inline)}var(--${t});`));
  }

  // ---- blocks that do not exist yet --------------------------------------------------------------------------------------
  let tail = "";
  const block = (head: string, lines: string[]) => { stats.blocks++; return `${eol}${head} {${eol}${lines.map((l) => unit + l).join(eol)}${eol}}${eol}`; };
  if (newBlock.light.length > 0 || (markerInNewBlock && !own.light[0])) tail += block(":root", [...(markerInNewBlock ? [markerText!] : []), ...newBlock.light]);
  if (newBlock.dark.length > 0) tail += block(darkClass, newBlock.dark);
  if (missingMap.length > 0 && !inline) tail += block("@theme inline", missingMap.map((t) => `--color-${t}: var(--${t});`));
  if (tail) {
    // a last statement without `;` would swallow the block appended after it
    const last = root.last;
    if (last && last.type !== "comment" && !(last.type === "rule" || (last.type === "atrule" && last.nodes)) && !/;\s*$/.test(css.slice(last.source!.start!.offset, css.length).replace(/\/\*[\s\S]*?\*\/\s*$/, ""))) throw new ApplyError(2, `line ${line(last)}: the file ends in a statement without ";"; nothing was written`);
  }
  if (tail) edit(css.length, css.length, (css.length === 0 || css.endsWith("\n") ? "" : eol) + (css.length === 0 ? tail.slice(eol.length) : tail));

  // ---- can our colors lose? ----------------------------------------------------------------------------------------------
  const oursFor = (m: "light" | "dark", tok: string) => {
    const rules = decls.filter((d) => d.own === m && d.token === tok).map((d) => ({ rule: d.rule, layered: d.layered }));
    const t = own[m].find((x) => x.rule === target(m));
    const list = rules.length > 0 ? rules : t ? [{ rule: t.rule, layered: t.layered }] : [];
    if (list.length === 0) return { offset: css.length, layered: false, spec: [0, 1, 0] as Spec };
    const spec = list.map((x) => splitSelectors(x.rule.selector).map(specificity).sort(cmp)[0]).sort(cmp)[0];
    return { offset: Math.max(...list.map((x) => x.rule.source!.start!.offset)), layered: list.every((x) => x.layered), spec };
  };
  const reported = new Set<string>();
  for (const d of decls.filter((x) => x.own === null)) {
    let code: Finding["code"] | undefined, sel = "";
    for (const m of ["light", "dark"] as const) {
      const ours = oursFor(m, d.token);
      for (const s of splitSelectors(d.rule.selector)) {
        let c: Finding["code"] | undefined;
        if (PAGE_CONTENT.test(s)) c = "W2";
        else if (PAGE_HTML.test(s)) {
          if (!d.layered && ours.layered) c = "W3";
          else if (d.layered && !ours.layered) c = undefined;
          else { const k = cmp(specificity(s), ours.spec); if (k > 0 || (k === 0 && d.rule.source!.start!.offset > ours.offset)) c = /:root|^html\b/.test(s) || darkSet.has(norm(s)) || s.includes(darkClass) ? "W1" : "W2"; }
        }
        if (c && !code) { code = c; sel = s; }
      }
    }
    if (!code) continue;
    const key = `${d.rule.source!.start!.offset}|${d.token}`;
    if (reported.has(key)) continue;
    reported.add(key);
    findings.push({ code, token: d.token, selector: sel, line: line(d.decl), message: `\`${sel}\` also sets --${d.token} and can win over the theme${code === "W3" ? " (it is outside the @layer that holds ours)" : ""}` });
  }
  findings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code));

  // ---- write ------------------------------------------------------------------------------------------------------------
  edits.sort((a, b) => b.start - a.start || b.seq - a.seq);
  let out = css;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (out !== css) { try { postcss.parse(out); } catch { throw new ApplyError(2, "internal check failed: the result does not parse; nothing was written"); } }
  const text = (bom ? "\uFEFF" : "") + out;
  return { text, changed: text !== input, stats, findings };
}
