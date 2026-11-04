import { STATUS_NAMES, type ThemeOptions, type TokenMap, buildTheme } from "../src/theme";
import type { Mode } from "../src/scale";
import { cr } from "./util";

export interface Pair { name: string; fg: string; bg: string; min: number }
export const CHARTS = [1, 2, 3, 4, 5].map((i) => `chart-${i}`);

/** Every text/surface pair of the mapping table (SPEC 3.3, T1-T3) and its gate. */
export function pairs(): Pair[] {
  const out: Pair[] = [];
  const P = (fg: string, bg: string, min: number) => out.push({ name: `${fg} on ${bg}`, fg, bg, min });
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
  // sidebar (shadcn): its own surface, accent and primary
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
  return out;
}
export const PAIRS = pairs();

export function violations(label: string, t: TokenMap): string[] {
  const bad: string[] = [];
  for (const p of PAIRS) {
    const r = cr(t[p.fg], t[p.bg]);
    if (r < p.min) bad.push(`${label}: ${p.name} ${r.toFixed(2)} < ${p.min}`);
  }
  return bad;
}
export const MODES: Mode[] = ["light", "dark"];
export function check(o: ThemeOptions, label: string) {
  const th = buildTheme(o);
  return MODES.flatMap((m) => violations(`${label} ${m}`, th[m]));
}
