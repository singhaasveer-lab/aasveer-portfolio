import { describe, expect, it } from "vitest";
import {
  COMPACT,
  FRONT,
  TAU,
  WIDE,
  approach,
  baseAngle,
  nearest,
  phaseToFront,
  place,
} from "../../src/components/certifications/orbit/geometry";

describe("Credential Orbit geometry", () => {
  it("keeps every card inside the stage at every angle", () => {
    for (const orbit of [WIDE, COMPACT]) {
      for (let a = 0; a < TAU; a += 0.05) {
        const p = place(a, orbit);
        for (const v of [p.x, p.y, p.nx, p.ny]) {
          expect(v).toBeGreaterThanOrEqual(0.05);
          expect(v).toBeLessThanOrEqual(0.95);
        }
      }
    }
  });

  it("puts the front of the orbit nearest the viewer: larger, brighter and on top", () => {
    const front = place(FRONT, WIDE);
    const back = place(FRONT + Math.PI, WIDE);
    expect(front.depth).toBeCloseTo(1);
    expect(back.depth).toBeCloseTo(-1);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.opacity).toBeGreaterThan(back.opacity);
    expect(front.z).toBeGreaterThan(back.z);
    expect(front.y).toBeGreaterThan(back.y);
  });

  it("never scales a card below a readable size, and never returns NaN", () => {
    for (const a of [Number.NaN, Number.POSITIVE_INFINITY, -1e9, 0, 1, 1e9]) {
      const p = place(a, WIDE);
      for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
      expect(p.scale).toBeGreaterThanOrEqual(0.84);
    }
  });

  it("spaces twelve credentials evenly, with no two cards on the same spot", () => {
    const points = Array.from({ length: 12 }, (_, i) => place(FRONT + baseAngle(i, 12), WIDE));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y);
        expect(d).toBeGreaterThan(0.1);
      }
    }
  });

  it("turns a chosen set to the front by the shortest way", () => {
    const phase = phaseToFront([3], 12, 0);
    const angle = phase + baseAngle(3, 12);
    expect(Math.cos(angle - FRONT)).toBeCloseTo(1);
    expect(Math.abs(phase)).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(phaseToFront([], 12, 2)).toBe(2);
    expect(Math.abs(nearest(10 * TAU + 0.1, 0) - 0.1)).toBeLessThan(1e-9);
  });

  it("eases towards a target without overshooting or moving backwards in time", () => {
    let p = 0;
    for (let i = 0; i < 200; i++) {
      const next = approach(p, 1, 16);
      expect(next).toBeGreaterThanOrEqual(p);
      expect(next).toBeLessThanOrEqual(1);
      p = next;
    }
    expect(p).toBe(1);
    expect(approach(0.5, 1, -400)).toBe(0.5);
    expect(approach(0.5, 1, Number.NaN)).toBe(0.5);
  });
});
