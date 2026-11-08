/**
 * Credential Orbit 3.0: the WebGL environment. Loaded lazily by CredentialSpace, client-side only.
 *
 * One scene, one camera, one render loop. The loop runs only while something moves and the stage
 * is on screen; React never re-renders per frame. Certificates are compact markers in 3D space;
 * their tags are HTML, placed each frame where the markers project and kept clear of each other
 * and of the core's safe zone.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  ENTRANCE,
  FRONT,
  ORBIT_PERIOD,
  Spring,
  TAU,
  coreZone,
  credentialPlacement,
  fittedEye,
  layoutTags,
  nearness,
  orbitPoint,
  phaseToFront,
  separate,
  stage,
  type Box,
  type OrbitDef,
  type SpaceLayout,
} from "./model";

const CYAN = 0x3fd5f5;
const CYAN_BRIGHT = 0x9ff0ff;
const BLUE = 0x4f7dff;
const VIOLET = 0x9b87ff;

export interface FrameItem {
  /** The tag's centre, as a fraction of the stage across and down. */
  x: number;
  y: number;
  /** The marker the tag belongs to, for the connector between them. */
  mx: number;
  my: number;
  /** 0 at the back of the system, 1 at the front. */
  near: number;
  visible: boolean;
}

export interface Frame {
  items: FrameItem[];
  /** The core caption's centre. */
  core: { x: number; y: number };
}

export interface SpaceState {
  /** Which credentials belong to the chosen academy; null for all academies. */
  hot: boolean[] | null;
  /** The credential being inspected. */
  selected: number | null;
  /** The last credential inspected: it stays marked after the inspector closes. */
  highlight: number | null;
  hovered: number | null;
  /** Visitor's pause button: everything holds still. */
  paused: boolean;
  /** Pointer or focus on the controls: the orbit holds, ambient motion continues. */
  holding: boolean;
  /** Pixels on the right the inspector covers; the camera frames the system beside it. */
  inset: number;
}

export interface SpaceOptions {
  host: HTMLElement;
  layout: SpaceLayout;
  count: number;
  reduced: boolean;
  compact: boolean;
  onFrame: (frame: Frame) => void;
  onLost: () => void;
}

export interface SpaceEngine {
  update(state: Partial<SpaceState>): void;
  setPointer(x: number, y: number, inside: boolean): void;
  setVisible(visible: boolean): void;
  enter(): void;
  resize(): void;
  debug(): Record<string, unknown>;
  dispose(): void;
}

/** A soft round glow, drawn once and shared by every halo. */
function glowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(200,245,255,0.75)");
  grad.addColorStop(0.45, "rgba(80,190,255,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The orbital plane's fine polar grid: rings and spokes, fading towards the rim. */
function gridTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const c = size / 2;
  g.strokeStyle = "rgba(140,200,255,0.55)";
  g.lineWidth = 1.2;
  for (let r = 40; r < c; r += 38) {
    g.globalAlpha = 0.5 * (1 - r / c) + 0.06;
    g.beginPath();
    g.arc(c, c, r, 0, TAU);
    g.stroke();
  }
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * TAU;
    g.globalAlpha = k % 4 === 0 ? 0.35 : 0.12;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60);
    g.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A closed orbit as a line, with its points in order so it can be drawn on progressively. */
function orbitLine(orbit: OrbitDef, segments: number, material: THREE.Material) {
  const points: number[] = [];
  for (let k = 0; k <= segments; k++) points.push(...orbitPoint(orbit, (k / segments) * TAU));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.Line(geometry, material);
}

/** The rotation that lays a torus (built in the xy-plane) onto an inclined orbit. */
function orbitQuaternion(orbit: OrbitDef) {
  const lay = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const tilt = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(orbit.tiltX, 0, orbit.tiltZ, "ZXY"),
  );
  return tilt.multiply(lay);
}

export function createSpace(options: SpaceOptions): SpaceEngine | null {
  const { host, layout, count, reduced, compact } = options;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = layout.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "cs-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("data-testid", "space-canvas");
  host.prepend(canvas);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  /* ---- Scene, atmosphere and camera ---- */
  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0x050a16, 0.03);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(layout.camera.fov, 1, 0.1, 90);

  // Subtle reflections for the metal, from a neutral studio environment.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.22;

  /* ---- Lighting: blue ambience, a soft key, cyan rim, an ultraviolet accent, the core ---- */
  scene.add(new THREE.AmbientLight(0x1d3b74, 0.5));
  scene.add(new THREE.HemisphereLight(0x5cc8ff, 0x04060c, 0.35));
  const key = new THREE.DirectionalLight(0xd2e9ff, 1.1);
  key.position.set(-6, 11, 7);
  if (layout.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0006;
    const s = key.shadow.camera;
    s.left = s.bottom = -8;
    s.right = s.top = 8;
    s.near = 1;
    s.far = 30;
  }
  scene.add(key);
  const rim = new THREE.PointLight(CYAN, 22, 30, 1.6);
  rim.position.set(7, 2.5, -7);
  scene.add(rim);
  const accent = new THREE.PointLight(VIOLET, 12, 26, 1.6);
  accent.position.set(-8, -0.5, -5);
  scene.add(accent);
  const coreLight = new THREE.PointLight(0x6fe3ff, 6, 9, 1.8);
  scene.add(coreLight);

  const glow = keep(glowTexture());

  /* ---- Background: the particle field, at its own depth ---- */
  const background = new THREE.Group();
  scene.add(background);
  {
    const n = layout.particles;
    const positions = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      // A flattened shell around the system, deterministic so every visit looks the same.
      const a = (k * 2.399963) % TAU;
      const r = 3 + (((k * 7919) % 1000) / 1000) * 11;
      positions[k * 3] = Math.cos(a) * r;
      positions[k * 3 + 1] = (((k * 104729) % 1000) / 1000 - 0.45) * 7;
      positions[k * 3 + 2] = Math.sin(a) * r - 1.5;
    }
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = keep(
      new THREE.PointsMaterial({
        size: 0.045,
        map: glow,
        color: 0x9fd8ff,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    background.add(new THREE.Points(geometry, material));
  }

  /* ---- The tilted orbital plane, with its polar grid ---- */
  const system = new THREE.Group();
  scene.add(system);
  const planeMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x07101f,
      metalness: 0.55,
      roughness: 0.62,
      transparent: true,
      opacity: 0,
    }),
  );
  const plane = new THREE.Mesh(keep(new THREE.CircleGeometry(8, 96)), planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.7;
  plane.receiveShadow = layout.shadows;
  system.add(plane);
  const gridMaterial = keep(
    new THREE.MeshBasicMaterial({
      map: keep(gridTexture()),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0x5fbfff,
    }),
  );
  const grid = new THREE.Mesh(keep(new THREE.CircleGeometry(8, 96)), gridMaterial);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.69;
  system.add(grid);

  /* ---- Orbital tracks: a metal primary ring with an emissive line, and fainter secondaries ---- */
  const metal = keep(
    new THREE.MeshStandardMaterial({
      color: 0x7fb4dc,
      metalness: 0.92,
      roughness: 0.24,
      emissive: 0x0f5a78,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0,
    }),
  );
  const primaryRing = new THREE.Mesh(
    keep(new THREE.TorusGeometry(layout.primary.radius, 0.022, 10, 360)),
    metal,
  );
  primaryRing.quaternion.copy(orbitQuaternion(layout.primary));
  primaryRing.position.y = layout.primary.y;
  system.add(primaryRing);

  const SEGMENTS = 360;
  const primaryGlowMaterial = keep(
    new THREE.LineBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const primaryGlow = orbitLine(layout.primary, SEGMENTS, primaryGlowMaterial);
  keep(primaryGlow.geometry);
  system.add(primaryGlow);

  // Background orbits move against the pointer, so the layers separate.
  const secondaryLayer = new THREE.Group();
  scene.add(secondaryLayer);
  const secondaryLines = layout.secondary.map((orbit, k) => {
    const material = keep(
      new THREE.LineBasicMaterial({
        color: k === layout.secondary.length - 1 && !compact ? VIOLET : BLUE,
        transparent: true,
        opacity: k === 0 ? 0.36 : 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const line = orbitLine(orbit, SEGMENTS, material);
    keep(line.geometry);
    secondaryLayer.add(line);
    return line;
  });
  if (!compact) {
    const ring = new THREE.Mesh(
      keep(new THREE.TorusGeometry(layout.secondary[0]!.radius, 0.01, 8, 300)),
      metal,
    );
    ring.quaternion.copy(orbitQuaternion(layout.secondary[0]!));
    ring.position.y = layout.secondary[0]!.y;
    secondaryLayer.add(ring);
  }

  /* ---- Light trails: comets travelling the tracks at their own speeds ---- */
  const TRAIL = 46;
  const comets = [
    { orbit: layout.primary, angle: 0.4, speed: 0.00016 },
    ...layout.secondary.slice(0, 2).map((orbit, k) => ({
      orbit,
      angle: 2.1 + k * 2.4,
      speed: (k % 2 ? -1 : 1) * (0.00011 + k * 0.00004),
    })),
  ].map((c) => {
    const geometry = keep(new THREE.BufferGeometry());
    const positions = new Float32Array(TRAIL * 3);
    const colors = new Float32Array(TRAIL * 3);
    const tint = new THREE.Color(c.orbit === layout.primary ? CYAN_BRIGHT : 0x7fa9ff);
    for (let j = 0; j < TRAIL; j++) {
      const fade = Math.pow(1 - j / TRAIL, 2.2);
      colors.set([tint.r * fade, tint.g * fade, tint.b * fade], j * 3);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = keep(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const line = new THREE.Line(geometry, material);
    (c.orbit === layout.primary ? system : secondaryLayer).add(line);
    return { ...c, line, positions };
  });

  /* ---- Particle flow along the primary orbit ---- */
  const flowCount = layout.flow;
  const flowPositions = new Float32Array(flowCount * 3);
  const flowColors = new Float32Array(flowCount * 3);
  const flowParam = Array.from({ length: flowCount }, (_, k) => (k / flowCount) * TAU);
  const flowJitter: [number, number][] = Array.from({ length: flowCount }, (_, k) => [
    (((k * 37) % 17) / 17 - 0.5) * 0.22,
    (((k * 53) % 13) / 13 - 0.5) * 0.12,
  ]);
  const flowGeometry = keep(new THREE.BufferGeometry());
  flowGeometry.setAttribute("position", new THREE.BufferAttribute(flowPositions, 3));
  flowGeometry.setAttribute("color", new THREE.BufferAttribute(flowColors, 3));
  const flowMaterial = keep(
    new THREE.PointsMaterial({
      size: 0.07,
      map: glow,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  system.add(new THREE.Points(flowGeometry, flowMaterial));

  /* ---- The credential core: a small lit crystal in a lattice, inside concentric rings ---- */
  const core = new THREE.Group();
  scene.add(core);
  const crystalMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x0b2440,
      metalness: 0.3,
      roughness: 0.18,
      emissive: 0x2fd3ff,
      emissiveIntensity: 1.05,
    }),
  );
  const crystal = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.34, 2)), crystalMaterial);
  crystal.castShadow = layout.shadows;
  core.add(crystal);
  const latticeMaterial = keep(
    new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.4 }),
  );
  const lattice = new THREE.LineSegments(
    keep(new THREE.EdgesGeometry(keep(new THREE.IcosahedronGeometry(0.62, 1)))),
    latticeMaterial,
  );
  core.add(lattice);
  // Concentric rings in the orbital plane: the core's quiet structure, turning at their own rates.
  const concentric = [0.95, 1.3, 1.62].map((radius, k) => {
    const ring = new THREE.Mesh(
      keep(new THREE.TorusGeometry(radius, 0.006 + k * 0.002, 6, 200)),
      metal,
    );
    ring.quaternion.copy(
      orbitQuaternion({ ...layout.primary, tiltX: layout.primary.tiltX + k * 0.05 }),
    );
    core.add(ring);
    return ring;
  });
  const haloMaterial = keep(
    new THREE.SpriteMaterial({
      map: glow,
      color: 0x58d8ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const halo = new THREE.Sprite(haloMaterial);
  halo.scale.setScalar(2.6);
  core.add(halo);

  /* ---- Certificates: compact markers above the path, joined to it by fine connectors ---- */
  const markerCoreMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x2fc8f0,
      emissiveIntensity: 1.5,
      metalness: 0.2,
      roughness: 0.3,
    }),
  );
  const markerCores = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(0.075, 18, 14)),
    markerCoreMaterial,
    count,
  );
  scene.add(markerCores);
  // The luminous ring around each marker, always facing the camera.
  const ringMaterial = keep(
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const markerRings = new THREE.InstancedMesh(
    keep(new THREE.RingGeometry(0.15, 0.172, 48)),
    ringMaterial,
    count,
  );
  scene.add(markerRings);
  const haloInstanceMaterial = keep(
    new THREE.MeshBasicMaterial({
      map: glow,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const markerHalos = new THREE.InstancedMesh(
    keep(new THREE.PlaneGeometry(1, 1)),
    haloInstanceMaterial,
    count,
  );
  scene.add(markerHalos);
  const pathNodes = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(0.035, 10, 8)),
    markerCoreMaterial,
    count,
  );
  scene.add(pathNodes);

  const connectorPositions = new Float32Array(count * 6);
  const connectorColors = new Float32Array(count * 6);
  const connectorGeometry = keep(new THREE.BufferGeometry());
  connectorGeometry.setAttribute("position", new THREE.BufferAttribute(connectorPositions, 3));
  connectorGeometry.setAttribute("color", new THREE.BufferAttribute(connectorColors, 3));
  const connectorMaterial = keep(
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(new THREE.LineSegments(connectorGeometry, connectorMaterial));

  /* ---- Pulse rings: a light pulse expanding from a marker when its academy is chosen ---- */
  const pulseGeometry = keep(new THREE.RingGeometry(0.92, 1, 48));
  const pulses: {
    i: number;
    start: number;
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
  }[] = [];
  function pulse(i: number, at: number) {
    const material = new THREE.MeshBasicMaterial({
      color: CYAN_BRIGHT,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(pulseGeometry, material);
    scene.add(mesh);
    pulses.push({ i, start: at, mesh, material });
  }

  /* ---- State and springs ---- */
  const state: SpaceState = {
    hot: null,
    selected: null,
    highlight: null,
    hovered: null,
    paused: false,
    holding: false,
    inset: 0,
  };
  const phase = new Spring(FRONT, 16, 8);
  const pointerX = new Spring(0, 34, 11.5);
  const pointerY = new Spring(0, 34, 11.5);
  const pan = new Spring(0, 60, 15.5);
  const focus = new Spring(0, 40, 13);
  const forward = Array.from({ length: count }, () => new Spring(0, 90, 19));
  const light = Array.from({ length: count }, () => new Spring(1, 60, 15.5));
  const lift = Array.from({ length: count }, () => new Spring(0, 110, 21));
  const hover = Array.from({ length: count }, () => new Spring(0, 160, 24));
  const magnetX = Array.from({ length: count }, () => new Spring(0, 140, 24));
  const magnetY = Array.from({ length: count }, () => new Spring(0, 140, 24));
  const springs = [
    phase,
    pointerX,
    pointerY,
    pan,
    focus,
    ...forward,
    ...light,
    ...lift,
    ...hover,
    ...magnetX,
    ...magnetY,
  ];

  let pointerPx: { x: number; y: number } | null = null;
  let visible = true;
  let entered = reduced ? -Infinity : Infinity;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let frames = 0;
  let width = 1;
  let height = 1;
  let eyeFull = new THREE.Vector3(...layout.camera.position);
  let eyeNarrow = eyeFull.clone();
  let tagsSmoothed: Box[] | null = null;

  const target = new THREE.Vector3(...layout.camera.target);
  const eye = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const look = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const hotColor = new THREE.Color(CYAN_BRIGHT);
  const baseColor = new THREE.Color(0x58c7ee);
  const dimColor = new THREE.Color(0x24324a);
  const markers = Array.from({ length: count }, () => new THREE.Vector3());

  const frame: Frame = {
    items: Array.from({ length: count }, () => ({
      x: 0,
      y: 0,
      mx: 0,
      my: 0,
      near: 0,
      visible: true,
    })),
    core: { x: 0.5, y: 0.5 },
  };

  function frameCamera() {
    eyeFull = new THREE.Vector3(...fittedEye(layout, width, height));
    eyeNarrow = compact
      ? eyeFull.clone()
      : new THREE.Vector3(...fittedEye(layout, Math.max(width - state.inset, width * 0.4), height));
  }

  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    frameCamera();
    tagsSmoothed = null;
    wake();
  }

  const orbitDrifting = () =>
    !reduced && !compact && !state.paused && !state.holding && state.selected === null;
  const ambientMoving = () => !reduced && !state.paused;

  function tick(now: number) {
    raf = 0;
    const dt = Math.min(64, Math.max(0, now - last));
    last = now;
    if (!visible) return;
    frames += 1;

    if (ambientMoving()) clock += dt;
    if (orbitDrifting()) {
      const step = (dt / ORBIT_PERIOD) * TAU;
      phase.value += step;
      phase.target += step;
    }
    for (const s of springs) {
      if (reduced) s.snap();
      else s.step(dt);
    }

    const since = now - entered;
    const reveal = (key: "atmosphere" | "core" | "tracks" | "nodes") =>
      reduced ? 1 : stage(since, ENTRANCE[key][0], ENTRANCE[key][1]);
    const atmosphere = reveal("atmosphere");
    const coreIn = reveal("core");
    const tracks = reveal("tracks");

    /* Camera: framed to fit, damped pointer parallax, lens shift beside the inspector. */
    eye.lerpVectors(eyeFull, eyeNarrow, pan.value);
    tmp.subVectors(target, eye).normalize();
    right.crossVectors(tmp, camera.up).normalize();
    up.crossVectors(right, tmp).normalize();
    const px = layout.parallax ? pointerX.value : 0;
    const py = layout.parallax ? pointerY.value : 0;
    camera.position
      .copy(eye)
      .addScaledVector(right, px * 0.7)
      .addScaledVector(up, -py * 0.35);
    look
      .copy(target)
      .addScaledVector(right, px * 0.15)
      .addScaledVector(up, -py * 0.07);
    look.z += focus.value * 0.5;
    camera.lookAt(look);
    // Pull the camera in a touch while an academy is in focus.
    tmp2.subVectors(look, camera.position).normalize();
    camera.position.addScaledVector(tmp2, focus.value * 0.5);
    if (pan.value > 0.001 && state.inset > 0) {
      camera.setViewOffset(width, height, (pan.value * state.inset) / 2, 0, width, height);
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
    camera.updateMatrixWorld();

    /* Layers: background turns slowly and leans against the pointer; secondaries counter-shift. */
    background.rotation.y = clock * 0.000012 + px * 0.05;
    background.rotation.x = py * 0.025;
    secondaryLayer.position.set(-px * 0.25, py * 0.12, 0);
    secondaryLayer.rotation.y = clock * -0.000006;

    /* Atmosphere and tracks reveal. */
    fog.density = 0.03 + (1 - atmosphere) * 0.08;
    planeMaterial.opacity = 0.9 * atmosphere;
    gridMaterial.opacity = 0.2 * atmosphere;
    metal.opacity = tracks;
    const drawn = Math.round((SEGMENTS + 1) * tracks);
    primaryGlow.geometry.setDrawRange(0, drawn);
    for (const line of secondaryLines) line.geometry.setDrawRange(0, drawn);
    primaryGlowMaterial.opacity = (0.55 + 0.12 * Math.sin(clock * 0.0011)) * tracks;

    /* Core: crystal and lattice turning at different rates, rings in slow counter-rotation. */
    core.scale.setScalar(Math.max(0.001, coreIn));
    crystal.rotation.y = clock * 0.00025;
    lattice.rotation.set(clock * 0.00011, clock * -0.00017, 0);
    concentric.forEach((ring, k) => ring.rotateZ((k % 2 ? -1 : 1) * dt * (reduced ? 0 : 0.00006)));
    halo.scale.setScalar(2.5 + Math.sin(clock * 0.0013) * 0.12 + focus.value * 0.35);
    haloMaterial.opacity = 0.42 * coreIn;
    coreLight.intensity = 6 * coreIn * (1 + focus.value * 0.4);

    /* Certificates. */
    let nearest = Infinity;
    let farthest = 0;
    const depths: number[] = [];
    const hotAngles: number[] = [];
    for (let i = 0; i < count; i++) {
      const place = credentialPlacement(layout, i, count, phase.value, clock);
      const appear = reduced ? 1 : stage(since, ENTRANCE.nodes[0] + i * 45, ENTRANCE.nodes[1]);
      const isHot = state.hot ? state.hot[i]! : null;
      if (isHot) hotAngles.push(place.angle);
      const marked = state.highlight === i || state.selected === i;

      // The marker: above its node, stepped toward the camera when in focus or selected,
      // leaning a little toward a nearby pointer.
      const m = markers[i]!.set(...place.marker);
      tmp2.subVectors(camera.position, m).normalize();
      m.addScaledVector(tmp2, forward[i]!.value + lift[i]!.value);
      m.addScaledVector(right, magnetX[i]!.value).addScaledVector(up, magnetY[i]!.value);

      const glowPulse = reduced
        ? 0
        : Math.pow(Math.max(0, Math.sin(clock * 0.0012 - i * 0.52)), 10);
      const b = light[i]!.value;
      const h = hover[i]!.value;
      const size = appear * (0.85 + b * 0.25 + h * 0.35 + (marked ? 0.2 : 0));
      color.copy(isHot === false ? dimColor : isHot || marked ? hotColor : baseColor);

      dummy.quaternion.identity();
      dummy.position.copy(m);
      dummy.scale.setScalar(Math.max(0.001, size));
      dummy.updateMatrix();
      markerCores.setMatrixAt(i, dummy.matrix);
      markerCores.setColorAt(i, color);

      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(Math.max(0.001, size * (1 + h * 0.25)));
      dummy.updateMatrix();
      markerRings.setMatrixAt(i, dummy.matrix);
      markerRings.setColorAt(i, tmpColor(color, (isHot === false ? 0.35 : 0.85) + h * 0.4));

      dummy.scale.setScalar(Math.max(0.001, appear * (0.5 + b * 0.3 + glowPulse * 0.4 + h * 0.4)));
      dummy.updateMatrix();
      markerHalos.setMatrixAt(i, dummy.matrix);
      markerHalos.setColorAt(i, tmpColor(color, 0.45 + glowPulse * 0.5 + h * 0.4));

      dummy.position.set(...place.node);
      dummy.quaternion.identity();
      dummy.scale.setScalar(Math.max(0.001, appear));
      dummy.updateMatrix();
      pathNodes.setMatrixAt(i, dummy.matrix);
      pathNodes.setColorAt(i, color);

      // Connector: from the path up to the marker; brighter on hover or selection.
      connectorPositions.set([...place.node, m.x, m.y, m.z], i * 6);
      const c = (isHot === false ? 0.22 : 0.6 + h * 0.4 + (marked ? 0.3 : 0)) * appear;
      connectorColors.set([0.3 * c, 0.85 * c, c, 0.3 * c, 0.85 * c, c], i * 6);

      // Projection of the marker, for its tag.
      tmp.copy(m).project(camera);
      const item = frame.items[i]!;
      item.x = item.mx = (tmp.x + 1) / 2;
      item.y = item.my = (1 - tmp.y) / 2;
      const depth = tmp2.copy(m).applyMatrix4(camera.matrixWorldInverse).z * -1;
      depths[i] = depth;
      nearest = Math.min(nearest, depth);
      farthest = Math.max(farthest, depth);
      item.visible = depth > 0.2 && appear > 0.6;

      // Magnetic hover: a marker leans a little toward a nearby pointer.
      if (pointerPx && !reduced && layout.parallax && state.selected === null) {
        const dx = pointerPx.x - item.x * width;
        const dy = pointerPx.y - item.y * height;
        const d = Math.hypot(dx, dy);
        const pull = d < 120 ? (1 - d / 120) * 0.08 : 0;
        magnetX[i]!.target = d > 0 ? (dx / d) * pull : 0;
        magnetY[i]!.target = d > 0 ? (-dy / d) * pull : 0;
      } else {
        magnetX[i]!.target = 0;
        magnetY[i]!.target = 0;
      }
    }
    for (let i = 0; i < count; i++) frame.items[i]!.near = nearness(depths[i]!, nearest, farthest);
    for (const mesh of [markerCores, markerRings, markerHalos, pathNodes]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    connectorGeometry.attributes.position!.needsUpdate = true;
    connectorGeometry.attributes.color!.needsUpdate = true;
    connectorMaterial.opacity = reveal("nodes");
    ringMaterial.opacity = reveal("nodes");

    /* Light trails. */
    for (const comet of comets) {
      comet.angle += (ambientMoving() ? dt : 0) * comet.speed * (1 + focus.value);
      for (let j = 0; j < TRAIL; j++) {
        const p = orbitPoint(comet.orbit, comet.angle - Math.sign(comet.speed) * j * 0.014);
        comet.positions.set(p, j * 3);
      }
      comet.line.geometry.attributes.position!.needsUpdate = true;
      (comet.line.material as THREE.LineBasicMaterial).opacity = tracks * 0.9;
    }

    /* Particle flow: faster, and brighter near the chosen academy's credentials. */
    const flowSpeed = (ambientMoving() ? 0.00009 : 0) * (1 + focus.value * 1.6);
    for (let k = 0; k < flowCount; k++) {
      flowParam[k]! += dt * flowSpeed * (0.8 + (k % 5) * 0.1);
      const a = flowParam[k]!;
      const [jr, jy] = flowJitter[k]!;
      const p = orbitPoint(layout.primary, a, layout.primary.radius + jr);
      flowPositions.set([p[0], p[1] + jy, p[2]], k * 3);
      let boost = 0;
      for (const h of hotAngles) {
        const d = Math.abs(((((a - h + Math.PI) % TAU) + TAU) % TAU) - Math.PI);
        if (d < 0.4) boost = Math.max(boost, 1 - d / 0.4);
      }
      const v = 0.28 + boost * 0.9;
      flowColors.set([0.35 * v, 0.85 * v, v], k * 3);
    }
    flowGeometry.attributes.position!.needsUpdate = true;
    flowGeometry.attributes.color!.needsUpdate = true;
    flowMaterial.opacity = tracks;

    /* Pulse rings. */
    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k]!;
      const t = (now - p.start) / 900;
      if (t >= 1) {
        scene.remove(p.mesh);
        p.material.dispose();
        pulses.splice(k, 1);
        continue;
      }
      if (t < 0) continue;
      p.mesh.position.copy(markers[p.i]!);
      p.mesh.quaternion.copy(camera.quaternion);
      p.mesh.scale.setScalar(0.15 + t * 0.6);
      p.material.opacity = (1 - t) * 0.9;
    }

    /* The core caption sits just under the crystal; its safe zone covers both. */
    const toStage = (point: [number, number, number]) => {
      tmp.set(...point).project(camera);
      return { x: (tmp.x + 1) / 2, y: (1 - tmp.y) / 2 };
    };
    const zone = coreZone(layout, toStage, width, height);
    frame.core.x = zone.centre.x;
    frame.core.y = zone.centre.y;

    /* Tags: beyond their markers, smoothed over time, never overlapping or in the safe zone. */
    const safe = zone.safe;
    const desired = layoutTags(layout, frame.items, zone.orbit, safe, width, height);
    const ease = reduced || !tagsSmoothed ? 1 : 1 - Math.exp(-dt / 90);
    tagsSmoothed = desired.map((d, i) => {
      const prev = tagsSmoothed?.[i] ?? d;
      return { ...d, x: prev.x + (d.x - prev.x) * ease, y: prev.y + (d.y - prev.y) * ease };
    });
    const nodeBoxes = layout.tag.onMarker
      ? []
      : frame.items.map((it) => ({ x: it.mx * width, y: it.my * height, w: 24, h: 24 }));
    tagsSmoothed = separate(tagsSmoothed, [safe, ...nodeBoxes], { width, height }, 4, 6);
    tagsSmoothed.forEach((t, i) => {
      frame.items[i]!.x = t.x / width;
      frame.items[i]!.y = t.y / height;
    });

    renderer.render(scene, camera);
    options.onFrame(frame);

    const settling = springs.some((s) => !s.settled);
    const entering = !reduced && since < ENTRANCE.total + 200;
    if (ambientMoving() || settling || entering || pulses.length > 0) wake();
  }

  const scratch = new THREE.Color();
  function tmpColor(base: THREE.Color, k: number) {
    return scratch.copy(base).multiplyScalar(k);
  }

  function wake() {
    if (raf || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  /* ---- Public interface ---- */
  function update(next: Partial<SpaceState>) {
    const before = { ...state };
    Object.assign(state, next);

    const hotChanged = JSON.stringify(before.hot) !== JSON.stringify(state.hot);
    if (hotChanged) {
      const indices = state.hot ? state.hot.flatMap((h, i) => (h ? [i] : [])) : [];
      focus.target = state.hot ? 1 : 0;
      for (let i = 0; i < count; i++) {
        const isHot = state.hot ? state.hot[i]! : null;
        forward[i]!.target = isHot === null ? 0 : isHot ? 0.45 : -0.3;
        light[i]!.target = isHot === null ? 1 : isHot ? 1.6 : 0.3;
      }
      if (state.hot) {
        phase.target = phaseToFront(indices, count, phase.value);
        const at = performance.now();
        if (!reduced) indices.forEach((i, k) => pulse(i, at + 250 + k * 110));
      }
    }
    if (before.selected !== state.selected || before.inset !== state.inset) {
      for (let i = 0; i < count; i++) lift[i]!.target = state.selected === i ? 0.9 : 0;
      if (before.inset !== state.inset) frameCamera();
      pan.target = state.selected === null || compact ? 0 : 1;
    }
    if (before.hovered !== state.hovered) {
      for (let i = 0; i < count; i++) hover[i]!.target = state.hovered === i ? 1 : 0;
    }
    if (reduced) for (const s of springs) s.snap();
    wake();
  }

  function setPointer(x: number, y: number, inside: boolean) {
    if (!layout.parallax || reduced) return;
    pointerX.target = inside ? Math.max(-1, Math.min(1, x)) : 0;
    pointerY.target = inside ? Math.max(-1, Math.min(1, y)) : 0;
    pointerPx = inside ? { x: ((x + 1) / 2) * width, y: ((y + 1) / 2) * height } : null;
    wake();
  }

  function setVisible(next: boolean) {
    visible = next;
    if (visible) wake();
    else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function enter() {
    if (entered !== Infinity) return;
    entered = performance.now();
    wake();
  }

  const onLost = (event: Event) => {
    event.preventDefault();
    options.onLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  resize();

  return {
    update,
    setPointer,
    setVisible,
    enter,
    resize,
    debug: () => ({
      // Where the orbital structure projects, as fractions of the stage: framing must keep it in.
      extent: (() => {
        const box = { minX: 1, maxX: 0, minY: 1, maxY: 0 };
        for (const orbit of [layout.primary, ...layout.secondary]) {
          const offset = orbit === layout.primary ? system.position : secondaryLayer.position;
          for (let k = 0; k < 96; k++) {
            const p = new THREE.Vector3(...orbitPoint(orbit, (k / 96) * TAU))
              .add(offset)
              .project(camera);
            const x = (p.x + 1) / 2;
            const y = (1 - p.y) / 2;
            box.minX = Math.min(box.minX, x);
            box.maxX = Math.max(box.maxX, x);
            box.minY = Math.min(box.minY, y);
            box.maxY = Math.max(box.maxY, y);
          }
        }
        return box;
      })(),
      core: (() => {
        const p = new THREE.Vector3(0, 0, 0).project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      })(),
      camera: camera.position.toArray(),
      target: look.toArray(),
      phase: phase.value,
      pan: pan.value,
      focus: focus.value,
      frames,
      running: raf !== 0,
      entered: entered !== Infinity,
      drifting: orbitDrifting(),
    }),
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("webglcontextlost", onLost);
      for (const p of pulses) p.material.dispose();
      for (const item of disposables) item.dispose();
      for (const mesh of [markerCores, markerRings, markerHalos, pathNodes]) mesh.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
