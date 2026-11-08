/**
 * The neural field's arithmetic, kept apart from the canvas so it can be tested. Everything here
 * returns a finite value in range, whatever it is given: a canvas throws on a negative arc radius,
 * and a single bad frame would otherwise feed itself into the next one.
 */

/** How far the pointer's influence reaches, in pixels. */
export const REACH = 250;
/** Time constants in milliseconds: nodes ease towards their target, and light fades more slowly. */
export const MOVE_TAU = 150;
export const GLOW_TAU = 230;
/** The radius of an unlit node at zero depth, and so the smallest one drawn. */
export const MIN_RADIUS = 1.1;

const MAX_STEP_MS = 50;
const DEFAULT_STEP_MS = 16;

export interface FieldNode {
  /** Resting position. */
  hx: number;
  hy: number;
  x: number;
  y: number;
  /** 0 is far away and barely moves; 1 is near and moves most. */
  depth: number;
  /** How strongly the pointer is lighting this node, from 0 to 1. */
  glow: number;
}

export interface FieldInput {
  /** The pointer, in pixels within the hero. */
  pointerX: number;
  pointerY: number;
  /** Whether the pointer is inside the hero. */
  on: boolean;
  /** The sprung pointer position, from -1 to 1. */
  driftX: number;
  driftY: number;
}

export const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

export const clamp01 = (value: number) => Math.min(1, Math.max(0, finiteOr(value, 0)));

/**
 * Milliseconds since the last frame. A frame's timestamp is when the frame began, so it can be
 * earlier than a performance.now() taken just before it was scheduled. That gap is not time running
 * backwards: left negative, it turned the easing below into a force pushing away from the target.
 */
export function frameElapsed(now: number, last: number) {
  const elapsed = now - last;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return DEFAULT_STEP_MS;
  return Math.min(MAX_STEP_MS, elapsed);
}

/** How far to move towards a target in this time, from 0 (none of the way) to 1 (all of it). */
export const easing = (elapsed: number, tau: number) => clamp01(1 - Math.exp(-elapsed / tau));

/** Eases one node towards where the pointer wants it, and returns how far it still has to go. */
export function stepNode(node: FieldNode, input: FieldInput, follow: number, fade: number) {
  // A value that has gone bad is reset, so it cannot spread into later frames.
  if (!Number.isFinite(node.x)) node.x = node.hx;
  if (!Number.isFinite(node.y)) node.y = node.hy;
  node.glow = clamp01(node.glow);

  const { pointerX, pointerY } = input;
  const on = input.on && Number.isFinite(pointerX) && Number.isFinite(pointerY);
  const driftX = finiteOr(input.driftX, 0);
  const driftY = finiteOr(input.driftY, 0);
  const depth = clamp01(node.depth);

  const distance = on ? Math.hypot(pointerX - node.hx, pointerY - node.hy) : Infinity;
  const linear = on ? Math.max(0, 1 - distance / REACH) : 0;
  const near = linear * linear * (3 - 2 * linear);
  const pullX = on ? (pointerX - node.hx) * near * 0.07 : 0;
  const pullY = on ? (pointerY - node.hy) * near * 0.07 : 0;

  const dx = node.hx - driftX * 14 * depth + pullX - node.x;
  const dy = node.hy - driftY * 10 * depth + pullY - node.y;
  const dGlow = near - node.glow;
  node.x += dx * clamp01(follow);
  node.y += dy * clamp01(follow);
  node.glow = clamp01(node.glow + dGlow * clamp01(fade));
  return Math.abs(dx) + Math.abs(dy) + Math.abs(dGlow);
}

/** Always finite, and never below the smallest visible node. */
export const nodeRadius = (depth: number, glow: number) =>
  Math.max(MIN_RADIUS, MIN_RADIUS + clamp01(depth) * 0.7 + clamp01(glow) * 1.9);

export const nodeAlpha = (depth: number, glow: number) =>
  clamp01(0.22 + clamp01(depth) * 0.2 + clamp01(glow) * 0.6);

export const linkAlpha = (glowA: number, glowB: number) =>
  clamp01(0.07 + ((clamp01(glowA) + clamp01(glowB)) / 2) * 0.55);
