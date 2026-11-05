import { contrast, mixHex } from "./color";
import type { Mode } from "./scale";
import { STATUS_NAMES, type Theme, type TokenMap } from "./theme";

/**
 * One text/surface relationship. Colors are resolved as: surface S = t[over ?? bg]... precisely:
 *   B = bgA ? mix(t[bg], t[over ?? "background"], bgA) : t[bg]      (an alpha fill over a surface, e.g. bg-destructive/10)
 *   F = fgA ? mix(t[fg], B, fgA) : t[fg]                             (alpha text, e.g. text-destructive/90)
 */
export interface AuditPair { name: string; fg: string; bg: string; min: number; fgA?: number; bgA?: number; over?: string; modes?: Mode[]; src?: string; /** `primary` used as TEXT: exempt when primaryMode is "vivid" (primary-text takes over) */ textPrimary?: boolean }
export const CHARTS = [1, 2, 3, 4, 5].map((i) => `chart-${i}`);
const SURFACES = ["background", "card", "popover", "muted", "sidebar"];

const label = (fg: string, bg: string, fgA?: number, bgA?: number, over?: string) =>
  `${fg}${fgA ? `/${fgA * 100}` : ""} on ${bg}${bgA ? `/${bgA * 100}` : ""}${over ? ` over ${over}` : ""}`;
const mk = (fg: string, bg: string, min: number, o: Partial<AuditPair> = {}): AuditPair => ({ name: label(fg, bg, o.fgA, o.bgA, o.over), fg, bg, min, ...o });

/** Every text/surface pair of the mapping table (SPEC 3.3, T1-T3) and of shadcn's radix-nova components (see docs/SPEC.md 12). */
function buildPairs(): AuditPair[] {
  const out: AuditPair[] = [];
  const P = (fg: string, bg: string, min: number, o: Partial<AuditPair> = {}) => out.push(mk(fg, bg, min, o));
  // T1 text: foreground 7:1 on every neutral surface, muted-foreground 4.5:1 on all of them
  for (const bg of ["background", "card", "popover", "muted", "secondary", "accent", "sidebar"]) {
    P(bg === "card" ? "card-foreground" : bg === "popover" ? "popover-foreground" : bg === "sidebar" ? "sidebar-foreground" : "foreground", bg, 7);
    P("muted-foreground", bg, 4.5);
  }
  P("foreground", "card", 7); P("foreground", "popover", 7);
  P("secondary-foreground", "secondary", 4.5);
  P("accent-foreground", "accent", 4.5);
  P("primary-foreground", "primary", 4.5);
  P("primary-foreground", "primary-hover", 4.5);
  P("sidebar-foreground", "sidebar-accent", 7);
  P("sidebar-accent-foreground", "sidebar-accent", 4.5);
  P("sidebar-primary-foreground", "sidebar-primary", 4.5);
  // D7: every status has the same 5 tokens
  for (const s of STATUS_NAMES) {
    P(`${s}-foreground`, s, 4.5);
    for (const bg of ["background", "card", `${s}-subtle`]) P(`${s}-text`, bg, 4.5);
    P(`${s}-border`, "background", 1.2); // identification, not WCAG 1.4.11
  }
  // T3 non-text 3:1 (D4 strict input border, focus ring, chart series); border is decorative
  for (const bg of ["background", "card", "sidebar"]) { P("ring", bg, 3); P("input", bg, 3); P("border", bg, 1.2); }
  for (const bg of ["background", "card"]) for (const c of CHARTS) P(c, bg, 3);
  P("sidebar-ring", "sidebar", 3); P("sidebar-border", "sidebar", 1.2);

  // --- shadcn components as shipped (O9): brand and destructive used as TEXT, and alpha fills ---
  // text-primary (link hover in item/empty/field) and text-destructive (field error, alert, trace, menu item) on every surface
  for (const s of SURFACES) P("destructive", s, 4.5, { src: "text-destructive" });
  for (const s of SURFACES) P("primary", s, 4.5, { src: "text-primary", textPrimary: true });
  P("primary", "muted", 4.5, { bgA: 0.5, over: "background", src: "item: text-primary on bg-muted/50", textPrimary: true });
  P("primary", "muted", 4.5, { bgA: 0.5, over: "card", src: "item: text-primary on bg-muted/50", textPrimary: true });
  // primary-text: the token to use for text-primary in "vivid" mode (equals primary in "accessible")
  for (const s of SURFACES) P("primary-text", s, 4.5, { src: "primary-text" });
  P("primary-text", "muted", 4.5, { bgA: 0.5, over: "background", src: "primary-text on muted/50" });
  P("primary-text", "muted", 4.5, { bgA: 0.5, over: "card", src: "primary-text on muted/50" });
  // bg-destructive/10 + text-destructive (light), dark:bg-destructive/20; hover /20 (light) and /30 (dark): button, badge, menu item, attachment
  for (const [mode, alphas] of [["light", [0.1, 0.2]], ["dark", [0.2, 0.3]]] as const)
    for (const a of alphas) for (const s of ["background", "card", "popover"]) P("destructive", "destructive", 4.5, { bgA: a, over: s, modes: [mode], src: "text-destructive on bg-destructive/N" });
  // hover:bg-primary/80 and hover:bg-secondary/80 keep their foreground text
  for (const s of ["background", "card", "popover", "sidebar"]) P("primary-foreground", "primary", 4.5, { bgA: 0.8, over: s, src: "hover:bg-primary/80" });
  for (const s of ["background", "card", "popover"]) P("secondary-foreground", "secondary", 4.5, { bgA: 0.8, over: s, src: "hover:bg-secondary/80" });
  // translucent neutral fills: bg-muted/50 (item, hover rows), bg-primary/5 (checked field), dark:bg-input/30 (inputs, active tab)
  for (const s of ["background", "card", "popover"]) {
    P("foreground", "muted", 7, { bgA: 0.5, over: s, src: "bg-muted/50" });
    P("muted-foreground", "muted", 4.5, { bgA: 0.5, over: s, src: "bg-muted/50" });
    P("muted-foreground", "input", 4.5, { bgA: 0.3, over: s, modes: ["dark"], src: "placeholder on dark:bg-input/30" });
    P("foreground", "input", 7, { bgA: 0.3, over: s, modes: ["dark"], src: "dark:bg-input/30" });
  }
  for (const s of ["background", "card"]) { P("foreground", "primary", 7, { bgA: 0.05, over: s, src: "has-data-checked:bg-primary/5" }); P("muted-foreground", "primary", 4.5, { bgA: 0.05, over: s, src: "bg-primary/5" }); }
  P("foreground", "input", 7, { bgA: 0.3, over: "muted", modes: ["dark"], src: "tabs: active trigger on the muted list" });
  // tooltip: text-background on bg-foreground, kbd inside it: bg-background/20 (light) | /10 (dark)
  P("background", "foreground", 7, { src: "tooltip" });
  P("background", "background", 4.5, { bgA: 0.2, over: "foreground", modes: ["light"], src: "kbd in tooltip" });
  P("background", "background", 4.5, { bgA: 0.1, over: "foreground", modes: ["dark"], src: "kbd in tooltip" });
  // alpha TEXT that still clears the gate once destructive is lifted: alert description /90, attachment error /80 (both on card)
  P("destructive", "card", 4.5, { fgA: 0.9, src: "alert description" });
  P("destructive", "card", 4.5, { fgA: 0.8, src: "attachment error text" });
  P("sidebar-foreground", "sidebar", 4.5, { fgA: 0.7, src: "sidebar group label text-sidebar-foreground/70" });
  // aria-invalid border: destructive on the surface is the only error indicator on the field edge
  for (const s of ["background", "card"]) P("destructive", s, 3, { src: "aria-invalid:border-destructive (non-text)" });
  return out;
}
/** Every text/surface relationship that is gated, see docs/SPEC.md 6 and 12. */
export const AUDIT_PAIRS: readonly AuditPair[] = buildPairs();

/** Alpha TEXT in shadcn components. Measured, reported in the SPEC, not gated (a token cannot rescue text that is itself translucent). */
export const ALPHA_TEXT: readonly AuditPair[] = [
  mk("foreground", "muted", 4.5, { fgA: 0.6, src: "tabs: text-foreground/60 on the muted list" }),
  mk("muted-foreground", "background", 4.5, { fgA: 0.7, src: "trace: text-muted-foreground/70" }),
  mk("muted-foreground", "card", 4.5, { fgA: 0.7, src: "trace: text-muted-foreground/70" }),
];

export function pairRatio(p: AuditPair, t: TokenMap): number {
  const surface = t[p.over ?? "background"];
  const bg = p.bgA ? mixHex(t[p.bg], surface, p.bgA) : t[p.bg];
  const fg = p.fgA ? mixHex(t[p.fg], bg, p.fgA) : t[p.fg];
  return contrast(fg, bg);
}


export interface AuditFinding { mode: Mode; name: string; ratio: number; min: number; src?: string }
export interface AuditResult {
  /** number of (pair, mode) checks run */
  checked: number;
  /** pairs under their gate */
  failed: AuditFinding[];
  /** pairs that pass but are within `margin` of the gate */
  thin: AuditFinding[];
  /** translucent text of shadcn components that no token can fix: measured, not gated */
  info: AuditFinding[];
}

/** Runs the whole pair table on a theme. `primaryMode: "vivid"` exempts the `text-primary` pairs (use `primary-text`). */
export function auditTheme(theme: Theme, { primaryMode = "accessible", margin = 0.2 }: { primaryMode?: "accessible" | "vivid"; margin?: number } = {}): AuditResult {
  const out: AuditResult = { checked: 0, failed: [], thin: [], info: [] };
  for (const mode of ["light", "dark"] as const) {
    const t = theme[mode];
    for (const p of AUDIT_PAIRS) {
      if (p.modes && !p.modes.includes(mode)) continue;
      if (p.textPrimary && primaryMode === "vivid") continue;
      out.checked++;
      const ratio = pairRatio(p, t), f: AuditFinding = { mode, name: p.name, ratio, min: p.min, src: p.src };
      if (ratio < p.min) out.failed.push(f);
      else if (ratio < p.min + margin) out.thin.push(f);
    }
    for (const p of ALPHA_TEXT) out.info.push({ mode, name: p.name, ratio: pairRatio(p, t), min: p.min, src: p.src });
  }
  return out;
}
