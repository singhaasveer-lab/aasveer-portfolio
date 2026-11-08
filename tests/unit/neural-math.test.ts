import { describe, expect, it } from "vitest";
import {
  easing,
  frameElapsed,
  GLOW_TAU,
  linkAlpha,
  MIN_RADIUS,
  MOVE_TAU,
  nodeAlpha,
  nodeRadius,
  stepNode,
  type FieldInput,
  type FieldNode,
} from "../../src/components/hero/neuralMath";

const node = (extra: Partial<FieldNode> = {}): FieldNode => ({
  hx: 100,
  hy: 100,
  x: 100,
  y: 100,
  depth: 0.5,
  glow: 0,
  ...extra,
});
const input = (extra: Partial<FieldInput> = {}): FieldInput => ({
  pointerX: 110,
  pointerY: 100,
  on: true,
  driftX: 0,
  driftY: 0,
  ...extra,
});
const BAD = [NaN, Infinity, -Infinity];

describe("nodeRadius", () => {
  it("keeps the original size for normal values", () => {
    expect(nodeRadius(0.25, 0)).toBeCloseTo(1.1 + 0.25 * 0.7);
    expect(nodeRadius(0.5, 0.5)).toBeCloseTo(1.1 + 0.5 * 0.7 + 0.5 * 1.9);
    expect(nodeRadius(1, 1)).toBeCloseTo(1.1 + 0.7 + 1.9);
  });

  it("stays visible with negative depth or negative glow", () => {
    expect(nodeRadius(-5, 0.5)).toBeCloseTo(MIN_RADIUS + 0.5 * 1.9);
    expect(nodeRadius(0.5, -1.2)).toBeCloseTo(MIN_RADIUS + 0.5 * 0.7);
    expect(nodeRadius(-5, -5)).toBe(MIN_RADIUS);
    // The value from the bug report: this glow gave a radius of -0.625014.
    expect(nodeRadius(0.25, -1)).toBeGreaterThan(0);
  });

  it("is finite and positive for invalid values", () => {
    for (const bad of BAD) {
      for (const radius of [nodeRadius(bad, 0.5), nodeRadius(0.5, bad), nodeRadius(bad, bad)]) {
        expect(Number.isFinite(radius)).toBe(true);
        expect(radius).toBeGreaterThanOrEqual(MIN_RADIUS);
      }
    }
  });

  it("does not grow past a fully lit near node, however large the input", () => {
    expect(nodeRadius(50, 50)).toBeCloseTo(1.1 + 0.7 + 1.9);
  });
});

describe("alpha values", () => {
  it("stay between 0 and 1", () => {
    for (const value of [-9, 0, 0.5, 1, 9, ...BAD]) {
      for (const alpha of [nodeAlpha(value, value), linkAlpha(value, value)]) {
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThanOrEqual(1);
      }
    }
  });

  it("brighten with glow", () => {
    expect(nodeAlpha(0.5, 1)).toBeGreaterThan(nodeAlpha(0.5, 0));
    expect(linkAlpha(1, 1)).toBeGreaterThan(linkAlpha(0, 0));
  });
});

describe("frameElapsed", () => {
  it("passes normal frame times through", () => {
    expect(frameElapsed(1016, 1000)).toBe(16);
  });

  it("caps a long gap", () => {
    expect(frameElapsed(5000, 1000)).toBe(50);
  });

  it("is never negative: the cause of the crash", () => {
    // A frame's timestamp can be earlier than performance.now() taken before it was scheduled.
    expect(frameElapsed(1000, 1400)).toBeGreaterThan(0);
  });

  it("falls back for a zero or invalid gap", () => {
    expect(frameElapsed(1000, 1000)).toBe(16);
    for (const bad of BAD) expect(frameElapsed(bad, 1000)).toBe(16);
    expect(frameElapsed(1000, NaN)).toBe(16);
  });
});

describe("easing", () => {
  it("moves part of the way for normal frames", () => {
    expect(easing(16, MOVE_TAU)).toBeCloseTo(1 - Math.exp(-16 / MOVE_TAU));
  });

  it("never pushes away from the target", () => {
    expect(easing(-400, GLOW_TAU)).toBe(0);
    for (const bad of BAD) {
      expect(easing(bad, MOVE_TAU)).toBeGreaterThanOrEqual(0);
      expect(easing(bad, MOVE_TAU)).toBeLessThanOrEqual(1);
    }
  });
});

describe("stepNode", () => {
  const follow = easing(16, MOVE_TAU);
  const fade = easing(16, GLOW_TAU);

  it("lights a node near the pointer, and leans it towards the pointer", () => {
    const n = node();
    stepNode(n, input(), follow, fade);
    expect(n.glow).toBeGreaterThan(0);
    expect(n.x).toBeGreaterThan(100);
  });

  it("settles back to rest when the pointer leaves", () => {
    const n = node({ x: 120, glow: 0.8 });
    for (let i = 0; i < 400; i++) stepNode(n, input({ on: false }), follow, fade);
    expect(n.glow).toBeCloseTo(0, 3);
    expect(n.x).toBeCloseTo(100, 3);
  });

  it("does not light a node beyond its reach", () => {
    const n = node();
    stepNode(n, input({ pointerX: 900 }), follow, fade);
    expect(n.glow).toBe(0);
  });

  it("stays in range through many frames with negative easing", () => {
    const n = node();
    // The crash: glow and position used to grow exponentially here.
    for (let i = 0; i < 500; i++)
      stepNode(n, input(), easing(-400, MOVE_TAU), easing(-400, GLOW_TAU));
    expect(n.glow).toBeGreaterThanOrEqual(0);
    expect(n.glow).toBeLessThanOrEqual(1);
    expect(Math.abs(n.x - 100)).toBeLessThan(50);
  });

  it("recovers a node holding invalid values", () => {
    for (const bad of BAD) {
      const n = node({ x: bad, y: bad, glow: bad, depth: bad });
      const gap = stepNode(n, input(), follow, fade);
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(Number.isFinite(n.glow)).toBe(true);
      expect(Number.isFinite(gap)).toBe(true);
    }
  });

  it("recovers a node whose glow is already negative", () => {
    const n = node({ glow: -1.2 });
    stepNode(n, input({ on: false }), follow, fade);
    expect(n.glow).toBeGreaterThanOrEqual(0);
  });

  it("ignores invalid pointer and drift input", () => {
    for (const bad of BAD) {
      const n = node();
      stepNode(n, input({ pointerX: bad, pointerY: bad, driftX: bad, driftY: bad }), follow, fade);
      expect(n.x).toBe(100);
      expect(n.y).toBe(100);
      expect(n.glow).toBe(0);
    }
  });

  it("ignores invalid easing", () => {
    for (const bad of BAD) {
      const n = node();
      stepNode(n, input(), bad, bad);
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.glow)).toBe(true);
    }
  });
});
