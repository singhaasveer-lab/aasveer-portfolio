/**
 * Credential Orbit 3.0: the spatial model, shared by the WebGL engine and the HTML layer.
 *
 * Plain math only (no three.js), so the server render, the no-WebGL fallback and the engine place
 * everything identically. World units; y is up, and the camera looks from +z towards the core.
 */

export type Vec3 = [number, number, number];

export const TAU = Math.PI * 2;
/** The front of an orbit, nearest the camera: +z. */
export const FRONT = Math.PI / 2;

export interface OrbitDef {
  radius: number;
  /** Inclination about x, then about z, in radians. */
  tiltX: number;
  tiltZ: number;
  /** Height of the orbit's centre. */
  y: number;
}

export interface CameraPreset {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view, degrees. */
  fov: number;
}

export interface SpaceLayout {
  primary: OrbitDef;
  secondary: OrbitDef[];
  camera: CameraPreset;
  /** How high a certificate marker floats above its node on the path. */
  lift: number;
  /** Markers alternate slightly in and out of the path, so they sit at different depths. */
  stagger: number;
  particles: number;
  flow: number;
  shadows: boolean;
  parallax: boolean;
  /** Tag size in pixels (see .cs-tag): placed beyond the path, or on the marker itself. */
  tag: { width: number; height: number; gap: number; onMarker: boolean };
  /**
   * The tag room the camera framing allows for. Kept apart from `tag`, so label sizes can change
   * without moving the camera, the orbit or any node.
   */
  fitTag: { width: number; height: number; gap: number; onMarker: boolean };
  /** The core's safe zone in pixels: tags keep out of it, leaving the centre clear. */
  caption: { width: number; height: number };
}

/** The full environment for wide screens. */
export const WIDE: SpaceLayout = {
  primary: { radius: 4.2, tiltX: 0.1, tiltZ: -0.05, y: 0 },
  secondary: [
    { radius: 5.5, tiltX: 0.34, tiltZ: 0.2, y: 0.2 },
    { radius: 6.2, tiltX: 0.12, tiltZ: -0.2, y: -0.35 },
  ],
  camera: { position: [0, 7.6, 12.4], target: [0, 0, 0], fov: 34 },
  lift: 0.2,
  stagger: 0.18,
  particles: 420,
  flow: 96,
  shadows: true,
  parallax: true,
  // Certificate name labels: number and academy, then the title on up to two lines.
  tag: { width: 168, height: 58, gap: 10, onMarker: false },
  fitTag: { width: 62, height: 46, gap: 10, onMarker: false },
  caption: { width: 232, height: 88 },
};

/** Phones: a smaller, simpler system seen from higher up. */
export const COMPACT: SpaceLayout = {
  primary: { radius: 3.4, tiltX: 0.08, tiltZ: 0, y: 0 },
  secondary: [{ radius: 4.3, tiltX: 0.3, tiltZ: 0.18, y: 0.15 }],
  camera: { position: [0, 10.2, 7.2], target: [0, 0, 0], fov: 46 },
  lift: 0.12,
  stagger: 0,
  particles: 150,
  flow: 40,
  shadows: false,
  parallax: false,
  tag: { width: 46, height: 46, gap: 0, onMarker: true },
  fitTag: { width: 46, height: 46, gap: 0, onMarker: true },
  caption: { width: 164, height: 74 },
};

/** One full turn of the primary orbit, in milliseconds. */
export const ORBIT_PERIOD = 140_000;

/* ---------------------------------------------------------------------------------------------- */
/* Vectors                                                                                         */

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A point on an inclined orbit: the circle in the xz-plane, tilted about x, then about z. */
export function orbitPoint(orbit: OrbitDef, angle: number, radius = orbit.radius): Vec3 {
  const a = Number.isFinite(angle) ? angle : 0;
  const x0 = radius * Math.cos(a);
  const z0 = radius * Math.sin(a);
  const y1 = -z0 * Math.sin(orbit.tiltX);
  const z1 = z0 * Math.cos(orbit.tiltX);
  const cz = Math.cos(orbit.tiltZ);
  const sz = Math.sin(orbit.tiltZ);
  return [x0 * cz - y1 * sz, x0 * sz + y1 * cz + orbit.y, z1];
}

/** 0 for a marker at the back of the system, 1 at the front. */
export const nearness = (depth: number, nearest: number, farthest: number) =>
  Math.min(1, Math.max(0, (farthest - depth) / Math.max(farthest - nearest, 1e-3)));

/** The angle of credential `i` of `count` before rotation. */
export const slot = (i: number, count: number) => (i / Math.max(count, 1)) * TAU;

/**
 * Where credential `i` sits: its node on the primary orbit, and its marker floating just above,
 * alternately a little inside and outside the path so neighbours sit at different depths.
 */
export function credentialPlacement(
  layout: SpaceLayout,
  i: number,
  count: number,
  phase: number,
  time = 0,
) {
  const angle = phase + slot(i, count);
  const node = orbitPoint(layout.primary, angle);
  const step = 0.28 + (i % 2 ? 1 : -1) * layout.stagger;
  const out = orbitPoint(layout.primary, angle, layout.primary.radius + step);
  const bob = Math.sin(time * 0.00055 + i * 1.7) * 0.05;
  const marker: Vec3 = [out[0], out[1] + layout.lift + bob, out[2]];
  return { node, marker, angle };
}

/* ---------------------------------------------------------------------------------------------- */
/* Camera projection and framing                                                                   */

export interface View {
  eye: Vec3;
  target: Vec3;
  fov: number;
  aspect: number;
}

export interface Projected {
  /** Fraction of the stage across and down; may fall outside 0 to 1. */
  x: number;
  y: number;
  /** Distance in front of the camera. */
  depth: number;
  visible: boolean;
}

/** Perspective projection matching three's PerspectiveCamera with the same eye, target and fov. */
export function project(point: Vec3, view: View): Projected {
  const forward = normalize(sub(view.target, view.eye));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const rel = sub(point, view.eye);
  const depth = dot(rel, forward);
  const t = Math.tan(((view.fov / 2) * Math.PI) / 180);
  const d = Math.max(depth, 1e-3);
  const nx = dot(rel, right) / (d * t * view.aspect);
  const ny = dot(rel, up) / (d * t);
  return { x: (nx + 1) / 2, y: (1 - ny) / 2, depth, visible: depth > 0.1 };
}

/** Every point the framing must keep in view: the tracks, and the markers above the path. */
function framePoints(layout: SpaceLayout): { point: Vec3; marker: boolean }[] {
  const points: { point: Vec3; marker: boolean }[] = [];
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * TAU;
    for (const orbit of [layout.primary, ...layout.secondary]) {
      points.push({ point: orbitPoint(orbit, a), marker: false });
    }
    const out = orbitPoint(layout.primary, a, layout.primary.radius + 0.28 + layout.stagger);
    points.push({ point: [out[0], out[1] + layout.lift, out[2]], marker: true });
  }
  return points;
}

/**
 * Frames the whole orbital structure in a stage of this size: the camera moves along its line of
 * sight to the nearest distance at which every track, and every marker with its tag, stays inside
 * safe margins. Wide stages bring it closer, narrow ones step it back; nothing is clipped.
 */
export function fittedEye(layout: SpaceLayout, width: number, height: number): Vec3 {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const aspect = w / h;
  // Tags sit beyond the markers (or on them), so markers keep a tag's room from every edge.
  const tag = layout.fitTag;
  const reach = tag.onMarker ? 0.5 : 1;
  const margin = {
    x: Math.max(0.04, (tag.width * reach + tag.gap + 12) / w),
    top: Math.max(0.05, (tag.height * reach + tag.gap + 12) / h),
    bottom: Math.max(0.05, (tag.height * reach + tag.gap + 12) / h),
  };
  const points = framePoints(layout);
  const { position, target } = layout.camera;
  const eyeAt = (s: number) => add(target, scale(sub(position, target), s));
  const fits = (s: number) => {
    const view: View = { eye: eyeAt(s), target, fov: layout.camera.fov, aspect };
    return points.every(({ point, marker }) => {
      const p = project(point, view);
      const mx = marker ? margin.x : 0.03;
      return (
        p.visible &&
        p.x >= mx &&
        p.x <= 1 - mx &&
        p.y >= (marker ? margin.top : 0.03) &&
        p.y <= 1 - (marker ? margin.bottom : 0.03)
      );
    });
  };
  let lo = 0.5;
  let hi = 4;
  if (!fits(hi)) return eyeAt(hi);
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return eyeAt(hi);
}

/* ---------------------------------------------------------------------------------------------- */
/* Label layout                                                                                     */

export interface Box {
  /** Centre, in pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Screen-space collision avoidance. Moves each tag the least distance needed so that no two tags
 * overlap, none enters an obstacle (the core's safe zone), and all stay inside the stage. A few
 * relaxation passes settle it; positions are returned in the same order.
 */
export function separate(
  tags: Box[],
  obstacles: Box[],
  bounds: { width: number; height: number },
  gap = 6,
  passes = 12,
): Box[] {
  const out = tags.map((t) => ({ ...t }));
  const clamp = (b: Box) => {
    b.x = Math.min(bounds.width - b.w / 2 - 4, Math.max(b.w / 2 + 4, b.x));
    b.y = Math.min(bounds.height - b.h / 2 - 4, Math.max(b.h / 2 + 4, b.y));
  };
  const push = (a: Box, b: Box, share: number) => {
    const ox = (a.w + b.w) / 2 + gap - Math.abs(a.x - b.x);
    const oy = (a.h + b.h) / 2 + gap - Math.abs(a.y - b.y);
    if (ox <= 0 || oy <= 0) return false;
    // Separate along the axis that needs the smaller move.
    if (ox < oy) {
      const dir = a.x < b.x ? -1 : a.x > b.x ? 1 : -1;
      a.x += dir * ox * share;
      b.x -= dir * ox * (1 - share);
    } else {
      const dir = a.y < b.y ? -1 : a.y > b.y ? 1 : -1;
      a.y += dir * oy * share;
      b.y -= dir * oy * (1 - share);
    }
    return true;
  };
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) moved = push(out[i]!, out[j]!, 0.5) || moved;
      for (const o of obstacles) moved = push(out[i]!, { ...o }, 1) || moved;
      clamp(out[i]!);
    }
    if (!moved) break;
  }
  return out;
}

/** True when any two boxes overlap. */
export function overlaps(boxes: Box[], gap = 0) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (
        Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap &&
        Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap
      )
        return true;
    }
  }
  return false;
}

/**
 * Lays out the HTML layer for one frame: each tag sits just above its marker, then collision
 * avoidance moves tags apart and out of the core's safe zone. Shared by the engine and fallback.
 */
/** A label's size on a stage this wide: narrower on tablets (see the container query in space.css). */
export function tagSize(layout: SpaceLayout, width: number) {
  const { tag } = layout;
  if (tag.onMarker) return { width: tag.width, height: tag.height };
  return { width: width < 860 ? 142 : tag.width, height: tag.height };
}

export function layoutTags(
  layout: SpaceLayout,
  markers: { x: number; y: number }[],
  centre: { x: number; y: number },
  safe: Box,
  width: number,
  height: number,
): Box[] {
  const { tag } = layout;
  const size = tagSize(layout, width);
  const tags = markers.map((m) => {
    const x = m.x * width;
    const y = m.y * height;
    if (tag.onMarker) return { x, y, w: size.width, h: size.height };
    // Beyond the path: outward from the orbit's centre, so no tag points into the interior.
    const dx = x - centre.x * width;
    const dy = y - centre.y * height;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const reach = tag.gap + Math.abs(ux) * (size.width / 2) + Math.abs(uy) * (size.height / 2);
    return { x: x + ux * reach, y: y + uy * reach, w: size.width, h: size.height };
  });
  // Labels keep clear of every node as well as of each other and the core.
  const nodes = tag.onMarker
    ? []
    : markers.map((m) => ({ x: m.x * width, y: m.y * height, w: 24, h: 24 }));
  return separate(tags, [safe, ...nodes], { width, height });
}

/**
 * The core caption's place and safe zone: centred just under the crystal, the zone covering both.
 * `project` maps a world point to stage fractions.
 */
export function coreZone(
  layout: SpaceLayout,
  project: (point: Vec3) => { x: number; y: number },
  width: number,
  height: number,
) {
  const under = project([0, -0.5, 0]);
  const top = project([0, 0.62, 0]).y * height;
  const centre = { x: under.x, y: under.y + layout.caption.height / 2 / height };
  const bottom = centre.y * height + layout.caption.height / 2;
  const safe: Box = {
    x: centre.x * width,
    y: (top + bottom) / 2,
    w: layout.caption.width,
    h: Math.max(layout.caption.height, bottom - top),
  };
  return { centre, safe, orbit: project([0, layout.primary.y, 0]) };
}

/* ---------------------------------------------------------------------------------------------- */
/* Motion                                                                                          */

/** A damped spring towards a target. `stiffness` and `damping` per second. Never NaN. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(
    value: number,
    public stiffness = 120,
    public damping = 22,
  ) {
    this.value = value;
    this.target = value;
  }
  step(ms: number) {
    let dt = Number.isFinite(ms) ? Math.min(Math.max(ms, 0), 64) / 1000 : 0;
    // Fixed substeps keep stiff springs stable on slow frames.
    while (dt > 0) {
      const h = Math.min(dt, 1 / 120);
      const force = this.stiffness * (this.target - this.value) - this.damping * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    if (!Number.isFinite(this.value)) this.snap(this.target);
    return this.value;
  }
  snap(value = this.target) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }
  get settled() {
    return Math.abs(this.target - this.value) < 1e-4 && Math.abs(this.velocity) < 1e-4;
  }
}

/** The angle closest to `from` that is equivalent to `target`. */
export const nearestAngle = (target: number, from: number) =>
  target + Math.round((from - target) / TAU) * TAU;

/** The rotation that brings a set of credentials to the front, by the shortest way. */
export function phaseToFront(indices: number[], count: number, from: number) {
  if (indices.length === 0) return from;
  let sx = 0;
  let sy = 0;
  for (const i of indices) {
    sx += Math.cos(slot(i, count));
    sy += Math.sin(slot(i, count));
  }
  return nearestAngle(FRONT - Math.atan2(sy, sx), from);
}

/** Smooth 0..1 progress of one stage of the entrance, with an ease-out. */
export function stage(elapsed: number, start: number, duration: number) {
  const t = Math.min(1, Math.max(0, (elapsed - start) / duration));
  return 1 - Math.pow(1 - t, 3);
}

/** The cinematic entrance, in milliseconds: atmosphere, core, tracks, nodes, selector, labels. */
export const ENTRANCE = {
  atmosphere: [0, 700],
  core: [300, 800],
  tracks: [700, 900],
  nodes: [1150, 750],
  selector: 1500,
  labels: 1800,
  total: 2300,
} as const;
