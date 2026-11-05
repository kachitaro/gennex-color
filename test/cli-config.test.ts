import { describe, expect, test } from "bun:test";
import { encodeConfig, normalizeConfig } from "../src/code";
import { ConfigError, resolveConfig } from "../src/cli-config";
import { devglowConfig } from "../src/devglow";
import { presetConfig } from "../src/presets";

const code = (c: object) => encodeConfig(normalizeConfig(c as never));

describe("flags and code give the same configuration (and the same code)", () => {
  test("--hue/--neutral/... equals the equivalent normalized config", () => {
    const r = resolveConfig({ hue: "40", neutral: "warm", kappa: "0.6", page: "2", primary: "vivid", status: "destructive=25.04,warning=70" });
    const c = normalizeConfig({ hue: 40, neutral: "warm", kappa: 0.6, pageStep: 2, primaryMode: "vivid", status: { warning: 70 } });
    expect(r.config).toEqual(c);
    expect(r.code).toBe(encodeConfig(c));
  });
  test("a code (positional or --code) decodes to the same config as the flags that made it", () => {
    const flags = resolveConfig({ hue: "217.5", neutral: "auto" });
    expect(resolveConfig({}, flags.code).config).toEqual(flags.config);
    expect(resolveConfig({ code: flags.code }).code).toBe(flags.code);
  });
  test("--neutral <hue>:<chroma>[:<chromaDark>] is a custom ramp", () => {
    expect(resolveConfig({ hue: "10", neutral: "70:0.0125:0.03" }).config.neutral).toEqual({ hue: 70, chroma: 0.0125, chromaDark: 0.03 });
  });
  test("presets: --preset blue, --devglow ember (+cap) and overrides on top", () => {
    expect(resolveConfig({ preset: "blue" }).config).toEqual(presetConfig("blue"));
    expect(resolveConfig({ devglow: "ember" }).config).toEqual(devglowConfig("ember"));
    expect(resolveConfig({ devglow: "plum", "dark-chroma-cap": "0.06" }).config).toEqual(devglowConfig("plum", { darkChromaCap: 0.06 }));
    expect(resolveConfig({ preset: "blue", kappa: "0.5", primary: "vivid" }).config).toEqual({ ...presetConfig("blue"), kappa: 0.5, primaryMode: "vivid" });
    expect(resolveConfig({ devglow: "ember", hue: "60" }).config.hue).toBe(60);
  });
  test("a code and flags are not mixed; no source at all is an error", () => {
    const c = code({ hue: 40 });
    for (const f of [{ hue: "40" }, { preset: "blue" }, { kappa: "0.5" }]) expect(() => resolveConfig(f, c)).toThrow(ConfigError);
    expect(() => resolveConfig({ code: c }, c)).toThrow(ConfigError);
    expect(() => resolveConfig({})).toThrow(/hue|code|preset/);
    expect(() => resolveConfig({ preset: "blue", devglow: "ember" })).toThrow(ConfigError);
  });
  test("bad values are refused with a message naming the flag", () => {
    for (const [f, re] of [[{ hue: "abc" }, /--hue/], [{ hue: "40", kappa: "2" }, /--kappa/], [{ hue: "40", page: "3" }, /--page/], [{ hue: "40", primary: "loud" }, /--primary/], [{ hue: "40", neutral: "hot" }, /--neutral/], [{ hue: "40", status: "oops=1" }, /--status/], [{ hue: "40", status: "info" }, /--status/], [{ preset: "nope" }, /preset/], [{ devglow: "nope" }, /devglow/], [{ hue: "400" }, /--hue/], [{ hue: "40", "dark-chroma-cap": "0.06" }, /dark-chroma-cap/]] as const)
      expect(() => resolveConfig(f as never)).toThrow(re);
    expect(() => resolveConfig({}, "a0000000")).toThrow(/check character|code/i);
  });
});
