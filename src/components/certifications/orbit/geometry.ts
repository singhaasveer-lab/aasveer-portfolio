/**
 * Geometry of the Credential Orbit, as fractions of the stage (0 to 1 across, 0 to 1 down).
 * The orbit is a circle seen at an angle, so it draws as an ellipse. Angles grow clockwise on
 * screen, and the front of the orbit, nearest the viewer, is straight down (PI / 2).
 *
 * Cards only ever move and scale. They are never rotated, so they stay upright and readable.
 */

export const TAU = Math.PI * 2;
export const FRONT = Math.PI / 2;

export interface Orbit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** How far a card sits outside its node, across and down. */
  ox: number;
  oy: number;
}

/** The wide orbit: cards around the whole path. */
export const WIDE: Orbit = { cx: 0.5, cy: 0.5, rx: 0.32, ry: 0.3, ox: 0.07, oy: 0.1 };
/** Phones: a shallow orbit near the top, with one card at its front. */
export const COMPACT: Orbit = { cx: 0.5, cy: 0.3, rx: 0.4, ry: 0.17, ox: 0, oy: 0 };

/** Radians per millisecond: one full turn every two and a half minutes. */
export const SPEED = TAU / 150_000;

export interface Placement {
  /** The node on the path. */
  nx: number;
  ny: number;
  /** The card's centre. */
  x: number;
  y: number;
  /** -1 at the back of the orbit, 1 at the front. */
  depth: number;
  scale: number;
  opacity: number;
  z: number;
}

/** The angle of item `i` of `count` around the orbit, before rotation. */
export const baseAngle = (i: number, count: number) => (i / Math.max(count, 1)) * TAU;

/** Where an item at `angle` sits, and how near the viewer it is. Always finite. */
export function place(angle: number, orbit: Orbit): Placement {
  const a = Number.isFinite(angle) ? angle : 0;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const depth = sin;
  const near = (depth + 1) / 2;
  return {
    nx: orbit.cx + orbit.rx * cos,
    ny: orbit.cy + orbit.ry * sin,
    x: orbit.cx + (orbit.rx + orbit.ox) * cos,
    y: orbit.cy + (orbit.ry + orbit.oy) * sin,
    depth,
    scale: 0.84 + 0.16 * near,
    opacity: 0.62 + 0.38 * near,
    z: Math.round(10 + near * 80),
  };
}

/** The same angle, moved by whole turns to lie within half a turn of `from`. */
export function nearest(target: number, from: number) {
  return target + Math.round((from - target) / TAU) * TAU;
}

/**
 * The rotation that brings a set of items to the front of the orbit: their circular mean faces
 * the viewer. Returns `from` unchanged for an empty set.
 */
export function phaseToFront(indices: number[], count: number, from: number) {
  if (indices.length === 0) return from;
  let sx = 0;
  let sy = 0;
  for (const i of indices) {
    sx += Math.cos(baseAngle(i, count));
    sy += Math.sin(baseAngle(i, count));
  }
  const mean = Math.atan2(sy, sx);
  return nearest(FRONT - mean, from);
}

/** Moves `phase` towards `target`, framerate-independent. Never overshoots. */
export function approach(phase: number, target: number, elapsed: number, ms = 420) {
  const dt = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const step = 1 - Math.exp(-dt / ms);
  const next = phase + (target - phase) * step;
  return Math.abs(target - next) < 1e-3 ? target : next;
}
