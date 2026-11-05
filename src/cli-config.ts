import { CodeError, decodeCode, encodeConfig, normalizeConfig, type NeutralChoice, type ThemeConfig } from "./code";
import { DEVGLOW_SEED_HUES, devglowConfig } from "./devglow";
import { presetConfig } from "./presets";
import { STATUS_NAMES, type StatusName } from "./theme";
import { CORE_HUES } from "./hues";

export class ConfigError extends Error {}
export interface ConfigFlags {
  code?: string; hue?: string; kappa?: string; neutral?: string; page?: string; primary?: string; status?: string;
  preset?: string; devglow?: string; "dark-chroma-cap"?: string;
}

const num = (flag: string, v: string, lo: number, hi: number) => {
  const n = Number(v);
  if (v.trim() === "" || !Number.isFinite(n) || n < lo || n > hi) throw new ConfigError(`--${flag} must be a number from ${lo} to ${hi} (got "${v}")`);
  return n;
};

/**
 * Flags or a share code -> the one configuration they stand for. A code replaces all other flags; `--preset`/`--devglow` give a
 * base that the other flags override. Returns the canonical code and notes (epoch warnings).
 */
export function resolveConfig(f: ConfigFlags, positional?: string): { config: ThemeConfig; code: string; notes: string[] } {
  if (positional && f.code) throw new ConfigError("give the code once (positional or --code)");
  const code = positional ?? f.code;
  const others = (["hue", "kappa", "neutral", "page", "primary", "status", "preset", "devglow", "dark-chroma-cap"] as const).filter((k) => f[k] !== undefined);
  if (code) {
    if (others.length) throw new ConfigError(`a code replaces the other flags (remove ${others.map((k) => `--${k}`).join(", ")})`);
    try {
      const d = decodeCode(code);
      return { config: d.config, code: encodeConfig(d.config), notes: d.warnings };
    } catch (e) {
      if (e instanceof CodeError) throw new ConfigError(`invalid code "${code}": ${e.message}`);
      throw e;
    }
  }
  if (f.preset && f.devglow) throw new ConfigError("use either --preset or --devglow, not both");
  if (f["dark-chroma-cap"] !== undefined && !f.devglow) throw new ConfigError("--dark-chroma-cap only applies with --devglow");
  let base: ThemeConfig | undefined;
  if (f.preset) {
    if (!CORE_HUES.some((h) => h.name === f.preset)) throw new ConfigError(`unknown preset "${f.preset}" (${CORE_HUES.map((h) => h.name).join(", ")})`);
    base = presetConfig(f.preset);
  } else if (f.devglow) {
    if (!(f.devglow in DEVGLOW_SEED_HUES)) throw new ConfigError(`unknown devglow palette "${f.devglow}" (${Object.keys(DEVGLOW_SEED_HUES).join(", ")})`);
    base = devglowConfig(f.devglow, f["dark-chroma-cap"] === undefined ? {} : { darkChromaCap: num("dark-chroma-cap", f["dark-chroma-cap"], 0, 0.1275) });
  } else if (f.hue === undefined) throw new ConfigError("give a share code, --preset <name>, --devglow <name> or --hue <0-360>");

  const o: Partial<ThemeConfig> = {};
  if (f.hue !== undefined) o.hue = num("hue", f.hue, 0, 360);
  if (f.kappa !== undefined) o.kappa = num("kappa", f.kappa, 0.35, 0.85);
  if (f.page !== undefined) { if (f.page !== "1" && f.page !== "2") throw new ConfigError(`--page must be 1 or 2 (got "${f.page}")`); o.pageStep = f.page === "2" ? 2 : 1; }
  if (f.primary !== undefined) { if (f.primary !== "accessible" && f.primary !== "vivid") throw new ConfigError(`--primary must be accessible or vivid (got "${f.primary}")`); o.primaryMode = f.primary; }
  if (f.neutral !== undefined) {
    if (["neutral", "cool", "warm", "auto"].includes(f.neutral)) o.neutral = f.neutral as NeutralChoice;
    else {
      const m = f.neutral.match(/^([\d.]+):([\d.]+)(?::([\d.]+))?$/);
      if (!m) throw new ConfigError(`--neutral must be neutral, cool, warm, auto or <hue>:<chroma>[:<chromaDark>] (got "${f.neutral}")`);
      o.neutral = { hue: num("neutral", m[1], 0, 360), chroma: num("neutral", m[2], 0, 0.1275), ...(m[3] !== undefined && { chromaDark: num("neutral", m[3], 0, 0.1275) }) };
    }
  }
  let status: Partial<Record<StatusName, number>> | undefined;
  if (f.status !== undefined) {
    status = {};
    for (const part of f.status.split(",")) {
      const [k, v] = part.split("=");
      if (!STATUS_NAMES.includes(k as StatusName) || v === undefined) throw new ConfigError(`--status must look like destructive=25,warning=70 (got "${part}")`);
      status[k as StatusName] = num("status", v, 0, 360);
    }
  }
  const b = base ?? ({ hue: 0, kappa: 0.85, neutral: "neutral", pageStep: 1, primaryMode: "accessible", status: {} } as ThemeConfig);
  const config = normalizeConfig({ ...b, ...o, status: { ...b.status, ...status } });
  return { config, code: encodeConfig(config), notes: [] };
}
