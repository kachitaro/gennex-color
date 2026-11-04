import { describe, expect, test } from "bun:test";
import { CORE_HUES } from "../src/hues";
import { CORE_RADIUS, NAME_RANGES, nameOfHue } from "../src/names";
import { hueGap } from "./util";

const R = NAME_RANGES;

describe("name table partitions the circle", () => {
  test("ranges are contiguous, wrap exactly once, total 360 deg", () => {
    expect(R.length).toBeGreaterThan(0);
    for (let i = 0; i < R.length; i++) {
      const next = i + 1 < R.length ? R[i + 1].from : R[0].from + 360;
      expect(R[i].to).toBe(next); // no gap, no overlap
      expect(R[i].to).toBeGreaterThan(R[i].from);
    }
    expect(R.reduce((a, r) => a + (r.to - r.from), 0)).toBe(360);
  });
  test("names are unique; core names are exactly the 12 core hues", () => {
    const names = R.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect(R.filter((r) => r.kind === "core").map((r) => r.name).sort()).toEqual(CORE_HUES.map((c) => c.name).sort());
  });
  test("each core range is exactly [hue-8, hue+8); sub ranges sit strictly between cores", () => {
    for (const c of CORE_HUES) {
      const r = R.find((x) => x.name === c.name)!;
      expect(((r.from - (c.hue - CORE_RADIUS)) % 360 + 360) % 360).toBe(0);
      expect(r.to - r.from).toBe(2 * CORE_RADIUS);
    }
    for (let i = 0; i < R.length; i++) if (R[i].kind === "sub") {
      expect(R[(i + R.length - 1) % R.length].kind).toBe("core");
      expect(R[(i + 1) % R.length].kind).toBe("core");
    }
  });
  test("every sub name has a real reference angle within 6 deg of its range (or is explicitly descriptive)", () => {
    for (const r of R.filter((x) => x.kind === "sub" && x.ref !== undefined)) {
      const mid = (r.from + r.to) / 2, half = (r.to - r.from) / 2;
      expect(hueGap(r.ref!, mid)).toBeLessThanOrEqual(half + 6);
    }
  });
});

describe("nameOfHue", () => {
  test("every angle 0-360 (step 0.01) has a name", () => {
    for (let i = 0; i <= 36000; i++) {
      const n = nameOfHue(i / 100);
      expect(n.name.length).toBeGreaterThan(0);
    }
  });
  test("exact core name at each core hue, and for the whole +-8 core span", () => {
    for (const c of CORE_HUES) {
      expect(nameOfHue(c.hue)).toEqual({ name: c.name, kind: "core", core: c.name, offset: 0 });
      for (const d of [-8, -7.99, -3, 3, 7.99]) {
        const n = nameOfHue(c.hue + d);
        expect(n.name).toBe(c.name);
        expect(n.kind).toBe("core");
      }
      expect(nameOfHue(c.hue + 8).kind).toBe("sub"); // half-open: +8 already belongs to the sub name
    }
  });
  test("sub names report nearest core and signed offset", () => {
    expect(nameOfHue(40)).toEqual({ name: "coral", kind: "sub", core: "orange", offset: -12 });
    expect(nameOfHue(34).core).toBe("red");
    expect(nameOfHue(34).offset).toBe(9);
  });
  test("wraps: 360 = 0, negatives, large values; value changes exactly once per range", () => {
    expect(nameOfHue(360)).toEqual(nameOfHue(0));
    expect(nameOfHue(-10)).toEqual(nameOfHue(350));
    expect(nameOfHue(725)).toEqual(nameOfHue(5));
    let changes = 0, prev = nameOfHue(0).name;
    for (let i = 1; i <= 3600; i++) { const n = nameOfHue(i / 10).name; if (n !== prev) changes++; prev = n; }
    expect(changes).toBe(R.length);
  });
  test("offset is the shortest signed arc to the nearest core and is within the gap", () => {
    for (let h = 0; h < 360; h += 0.5) {
      const n = nameOfHue(h);
      const core = CORE_HUES.find((c) => c.name === n.core)!;
      expect(Math.abs(n.offset)).toBeLessThanOrEqual(hueGap(h, core.hue) + 1e-9);
      expect(Math.abs(n.offset)).toBeLessThanOrEqual(21);
      for (const c of CORE_HUES) expect(hueGap(h, core.hue)).toBeLessThanOrEqual(hueGap(h, c.hue) + 1e-9);
    }
  });
});
