import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CODE_ALPHABET, CodeError, ENGINE_EPOCH, EPOCH_VERSIONS, decodeCode, encodeConfig, normalizeConfig, sealPayload, configToThemeOptions, type ThemeConfig } from "../src/code";
import { devglowConfig } from "../src/devglow";
import { presetConfig } from "../src/presets";
import { toCss } from "../src/css";
import { auditTheme } from "../src/audit";
import { buildTheme } from "../src/theme";

const A = CODE_ALPHABET;
const rng = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); })();
const pick = <T,>(a: readonly T[]) => a[Math.floor(rng() * a.length)];
function randomConfig(): ThemeConfig {
  const neutral = pick(["neutral", "cool", "warm", "auto", "custom"] as const);
  return normalizeConfig({
    hue: rng() * 360, kappa: rng() < 0.4 ? undefined : 0.35 + rng() * 0.5, pageStep: pick([1, 2] as const), primaryMode: pick(["accessible", "vivid"] as const),
    neutral: neutral === "custom" ? { hue: rng() * 360, chroma: rng() * 0.1, chromaDark: rng() < 0.5 ? rng() * 0.1 : undefined, canvasDark: rng() < 0.5 ? 0.12 + rng() * 0.1 : undefined } : neutral,
    status: Object.fromEntries((["destructive", "success", "warning", "info"] as const).filter(() => rng() < 0.3).map((k) => [k, rng() * 360])),
  });
}
const codeOf = (c: ThemeConfig) => encodeConfig(c);
const err = (code: string, opts?: object) => { try { decodeCode(code, opts); } catch (e) { return e as CodeError; } return undefined; };

describe("alphabet and lengths", () => {
  test("61 unique characters, no 'z', no '-' or '_' (double-click selectable)", () => {
    expect(A).toHaveLength(61);
    expect(new Set(A).size).toBe(61);
    expect(A).not.toContain("z");
    expect(A).toMatch(/^[0-9A-Za-y]+$/);
  });
  test("hue-only config is 7 characters; the fullest config is at most 22", () => {
    expect(codeOf(normalizeConfig({ hue: 40 }))).toHaveLength(7);
    const full = normalizeConfig({ hue: 359.9, kappa: 0.35, neutral: { hue: 359.9, chroma: 0.1275, chromaDark: 0.1, canvasDark: 0.2 }, pageStep: 2, primaryMode: "vivid", status: { destructive: 1.1, success: 2.2, warning: 3.3, info: 4.4 } });
    expect(codeOf(full).length).toBeLessThanOrEqual(22);
    expect(codeOf(full).length).toBeGreaterThan(18);
    expect(codeOf(full)[0]).toBe("a");
  });
});

describe("encode/decode", () => {
  test("decode(encode(c)) equals normalize(c) over 3000 random configs", () => {
    for (let i = 0; i < 3000; i++) {
      const c = randomConfig(), code = codeOf(c), d = decodeCode(code);
      expect([code, d.config]).toEqual([code, c]);
      expect(d.epoch).toBe(ENGINE_EPOCH);
      expect(d.warnings).toEqual([]);
    }
  });
  test("one config, one code: defaults written explicitly give the same code; rounding is applied before encoding", () => {
    const base = codeOf(normalizeConfig({ hue: 40 }));
    expect(codeOf(normalizeConfig({ hue: 40, kappa: 0.85, neutral: "neutral", pageStep: 1, primaryMode: "accessible", status: { destructive: 25, success: 156, warning: 80, info: 255 } }))).toBe(base);
    expect(codeOf(normalizeConfig({ hue: 40.04 }))).toBe(base);
    expect(codeOf(normalizeConfig({ hue: 400 }))).toBe(codeOf(normalizeConfig({ hue: 40 })));
    expect(codeOf(normalizeConfig({ hue: -320 }))).toBe(base);
    expect(codeOf(normalizeConfig({ hue: 359.96 }))).toBe(codeOf(normalizeConfig({ hue: 0 })));
    expect(normalizeConfig({ hue: 10, kappa: 0.9 }).kappa).toBe(0.85);
    expect(normalizeConfig({ hue: 10, kappa: 0.1 }).kappa).toBe(0.35);
    expect(normalizeConfig({ hue: 10, neutral: { hue: 123, chroma: 0 } }).neutral).toBe("neutral");
  });
  test("configToThemeOptions feeds buildTheme exactly like the equivalent options", () => {
    const c = normalizeConfig({ hue: 40, neutral: "warm", pageStep: 2, primaryMode: "vivid", kappa: 0.6, status: { warning: 70 } });
    expect(buildTheme(configToThemeOptions(c))).toEqual(buildTheme({ hue: 40, neutral: "warm", pageStep: 2, primaryMode: "vivid", kappa: 0.6, status: { warning: 70 } }));
  });
});

describe("checksum: exhaustive single-character and adjacent-swap detection", () => {
  test("on 1200 random codes, EVERY single-character substitution and EVERY adjacent swap is rejected", () => {
    let mutations = 0;
    for (let n = 0; n < 1200; n++) {
      const code = codeOf(randomConfig());
      for (let i = 0; i < code.length; i++) for (const ch of A) if (ch !== code[i]) {
        const m = code.slice(0, i) + ch + code.slice(i + 1);
        const e = err(m); mutations++;
        expect([m, e?.code]).toEqual([m, i === 0 ? "version" : "checksum"]);
      }
      for (let i = 0; i + 1 < code.length; i++) if (code[i] !== code[i + 1]) {
        const m = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
        const e = err(m); mutations++;
        expect([m, e === undefined]).toEqual([m, false]);
        expect(e!.code).toBe(i === 0 ? "version" : "checksum");
      }
    }
    expect(mutations).toBeGreaterThan(700_000);
  });
  test("reference: Luhn mod 62 would let '0' <-> 'z' swaps through (why the alphabet has 61 characters and a weighted sum)", () => {
    const N = 62, add = (d: number) => Math.floor((2 * d) / N) + ((2 * d) % N);
    const check = (ds: number[]) => { let s = 0, dbl = true; for (let i = ds.length - 1; i >= 0; i--) { s += dbl ? add(ds[i]) : ds[i]; dbl = !dbl; } return (N - (s % N)) % N; };
    const valid = (ds: number[]) => check(ds.slice(0, -1)) === ds.at(-1);
    const p = [5, 0, 61, 7, 3], code = [...p, check(p)], swapped = [5, 61, 0, 7, 3, code.at(-1)!];
    expect(valid(code)).toBe(true);
    expect(valid(swapped)).toBe(true);
  });
});

describe("rejecting bad codes", () => {
  const ok = codeOf(normalizeConfig({ hue: 40 }));
  test("shape: not a string, empty, too short, too long, characters outside the alphabet", () => {
    expect(err("")?.code).toBe("length");
    expect(err("a")?.code).toBe("length");
    expect(err(ok.slice(0, 6))?.code).toBe("length");
    expect(err(ok + "0".repeat(20))?.code).toBe("length");
    expect(err(ok.slice(0, 3) + "z" + ok.slice(4))?.code).toBe("alphabet");
    expect(err(ok.slice(0, 3) + "-" + ok.slice(4))?.code).toBe("alphabet");
    expect(err(ok + " ")?.code).toBe("alphabet");
    expect(() => decodeCode(undefined as unknown as string)).toThrow(CodeError);
  });
  test("unknown version character, wrong checksum (separate message)", () => {
    expect(err("b" + ok.slice(1))?.code).toBe("version");
    const bad = ok.slice(0, -1) + A[(A.indexOf(ok.at(-1)!) + 1) % 61];
    const e = err(bad)!;
    expect(e.code).toBe("checksum");
    expect(e.message).toMatch(/check character/i);
  });
  test("well-sealed but invalid payloads: epoch 0, hue >= 3600, bad neutral kind, kappa out of range, trailing bits, non-canonical flags", () => {
    const seal = (bits: string) => sealPayload(BigInt("0b1" + bits));
    const b = (v: number, n: number) => v.toString(2).padStart(n, "0");
    const head = (o: { epoch?: number; hue?: number; kf?: number; nk?: number; pg?: number; pm?: number; mask?: number } = {}) => b(o.epoch ?? 1, 3) + b(o.hue ?? 400, 12) + b(o.kf ?? 0, 1) + b(o.nk ?? 0, 3) + b(o.pg ?? 0, 1) + b(o.pm ?? 0, 1) + b(o.mask ?? 0, 4);
    expect(err(seal(head()))).toBeUndefined(); // sanity: a canonical payload is accepted
    expect(err(seal(head({ epoch: 0 })))?.code).toBe("epoch");
    expect(err(seal(head({ hue: 3600 })))?.code).toBe("range");
    expect(err(seal(head({ nk: 7 })))?.code).toBe("range");
    expect(err(seal(head({ kf: 1 }) + b(51, 6)))?.code).toBe("range");
    expect(err(seal(head({ kf: 1 }) + b(50, 6)))?.code).toBe("noncanonical"); // 0.85 is the default: flag must be off
    expect(err(seal(head() + "0"))?.code).toBe("padding");
    expect(err(seal(head({ mask: 1 }) + b(250, 12)))?.code).toBe("noncanonical"); // destructive hue equals its default 25.0
    expect(err(seal(head({ nk: 4 }) + b(0, 12) + b(0, 8) + "0" + "0"))?.code).toBe("noncanonical"); // custom neutral with chroma 0 is just "neutral"
    expect(err(seal(head().slice(0, 24)))?.code).toBe("padding"); // truncated payload (shorter ones are already too short for a code)
  });
});

describe("epochs (D20)", () => {
  test("a code from an older epoch decodes, warns, and names the version that reproduces it", () => {
    const old = encodeConfig(normalizeConfig({ hue: 40 }), { epoch: 1 });
    const d = decodeCode(old, { engineEpoch: 2, epochVersions: { 1: { first: "0.2.0", last: "0.2.9" }, 2: { first: "0.3.0", last: null } } });
    expect(d.epoch).toBe(1);
    expect(d.warnings).toHaveLength(1);
    expect(d.warnings[0]).toContain(`npx gennex-color@0.2.9 apply ${old}`);
    expect(d.warnings[0]).toMatch(/epoch 1/);
  });
  test("a code from a newer epoch than this package asks to upgrade, never guesses", () => {
    const fresh = encodeConfig(normalizeConfig({ hue: 40 }), { epoch: 3 });
    const e = err(fresh, { engineEpoch: 2 })!;
    expect(e.code).toBe("epoch");
    expect(e.message).toMatch(/upgrade/i);
  });
  test("EPOCH_VERSIONS covers every epoch up to ENGINE_EPOCH, newest still open", () => {
    for (let e = 1; e <= ENGINE_EPOCH; e++) expect(EPOCH_VERSIONS[e].first).toMatch(/^\d+\.\d+\.\d+$/);
    expect(EPOCH_VERSIONS[ENGINE_EPOCH].last).toBeNull();
  });
});

describe("presets expand to explicit configs (so re-syncing devglow never changes an old code)", () => {
  const CORE = ["red", "orange", "amber", "yellow", "lime", "green", "teal", "cyan", "blue", "violet", "magenta", "pink"];
  const DG = ["amber", "ash", "blush", "dusk", "ember", "mocha", "moss", "nocturne", "plum", "sage", "tide", "vesper"];
  test("every preset round-trips, builds a theme that passes the audit in both primary modes", () => {
    const all = [...CORE.map((n) => presetConfig(n)), ...DG.flatMap((n) => [devglowConfig(n), devglowConfig(n, { darkChromaCap: 0.06 })])];
    for (const c of all) {
      expect(decodeCode(codeOf(c)).config).toEqual(c);
      for (const primaryMode of ["accessible", "vivid"] as const) {
        const r = auditTheme(buildTheme(configToThemeOptions({ ...c, primaryMode })), { primaryMode });
        expect(r.failed).toEqual([]);
      }
    }
    // one config, one code, and different configs never share one (a devglow preset whose dark tint equals its light one is the same config with or without the cap)
    expect(new Set(all.map(codeOf)).size).toBe(new Set(all.map((c) => JSON.stringify(c))).size);
  });
  test("a devglow config is explicit data (custom neutral), not a name", () => {
    const c = devglowConfig("ember");
    expect(typeof c.neutral).toBe("object");
    expect(c.hue).toBe(40);
  });
});

describe("golden codes (frozen: change the algorithm => bump ENGINE_EPOCH and regenerate)", () => {
  const golden = JSON.parse(readFileSync("test/codes.golden.json", "utf8")) as { epoch: number; entries: { code: string; config: ThemeConfig; themeHash: string }[] };
  const hash = (c: ThemeConfig) => createHash("sha256").update(toCss(buildTheme(configToThemeOptions(c)))).digest("hex");
  test("at least 200 entries, all for this epoch", () => {
    expect(golden.entries.length).toBeGreaterThanOrEqual(200);
    expect(golden.epoch).toBe(ENGINE_EPOCH);
  });
  test("every code still decodes to its recorded config and re-encodes to the same code", () => {
    for (const e of golden.entries) { expect(decodeCode(e.code).config).toEqual(e.config); expect(encodeConfig(e.config)).toBe(e.code); }
  });
  test("every recorded config still produces byte-identical CSS (red here means: bump ENGINE_EPOCH)", () => {
    const bad = golden.entries.filter((e) => hash(e.config) !== e.themeHash).map((e) => e.code);
    expect(bad).toEqual([]);
  });
});

test("the current epoch starts at a version that is not newer than this package", async () => {
  const { version } = await Bun.file("package.json").json();
  const { EPOCH_VERSIONS, ENGINE_EPOCH } = await import("../src/code");
  const v = (s: string) => s.split(".").map(Number);
  const [a, b] = [v(EPOCH_VERSIONS[ENGINE_EPOCH].first), v(version)];
  expect(a[0] * 1e6 + a[1] * 1e3 + a[2]).toBeLessThanOrEqual(b[0] * 1e6 + b[1] * 1e3 + b[2]);
  expect(EPOCH_VERSIONS[ENGINE_EPOCH].last).toBeNull();
});
