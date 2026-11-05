import { ALPHA_TEXT, AUDIT_PAIRS, CHARTS, auditTheme, pairRatio, type AuditPair } from "../src/audit";
import type { Mode } from "../src/scale";
import { buildTheme, type ThemeOptions } from "../src/theme";

// The pair table lives in src/audit.ts (shipped); these names keep the existing tests unchanged.
export type Pair = AuditPair;
export const PAIRS = AUDIT_PAIRS;
export { ALPHA_TEXT, CHARTS, pairRatio as ratio };
export const MODES: Mode[] = ["light", "dark"];

export function check(o: ThemeOptions, label: string) {
  return auditTheme(buildTheme(o), { primaryMode: o.primaryMode }).failed.map((f) => `${label} ${f.mode}: ${f.name} ${f.ratio.toFixed(2)} < ${f.min}`);
}
