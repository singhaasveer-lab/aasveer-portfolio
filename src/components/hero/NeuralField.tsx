"use client";

import { useEffect, useRef } from "react";
import { useHeroPointer } from "@/components/hero/HeroMotion";
import {
  easing,
  frameElapsed,
  GLOW_TAU,
  linkAlpha,
  MOVE_TAU,
  nodeAlpha,
  nodeRadius,
  stepNode,
  type FieldNode,
} from "@/components/hero/neuralMath";

type Link = readonly [number, number];

const MAX_DPR = 2;

/** A small seeded generator, so the network is the same on every visit. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nodes on a jittered grid, thinning towards the text, each linked to its nearest neighbours. */
function buildNetwork(width: number, height: number) {
  const next = random(7);
  const cell = width < 700 ? 84 : 112;
  const nodes: FieldNode[] = [];
  for (let y = cell / 2; y < height; y += cell) {
    for (let x = cell / 2; x < width; x += cell) {
      if (next() > 0.28 + (x / width) * 0.72) continue;
      const hx = x + (next() - 0.5) * cell * 0.8;
      const hy = y + (next() - 0.5) * cell * 0.8;
      nodes.push({ hx, hy, x: hx, y: hy, depth: 0.25 + next() * 0.75, glow: 0 });
    }
  }
  const seen = new Set<string>();
  const links: Link[] = [];
  nodes.forEach((a, i) => {
    const nearest = nodes
      .map((b, j) => ({ j, d: Math.hypot(a.hx - b.hx, a.hy - b.hy) }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 3);
    for (const { j } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push(i < j ? [i, j] : [j, i]);
    }
  });
  return { nodes, links };
}

/**
 * The neural environment behind the hero, drawn on one canvas. Near the pointer, nodes lean in
 * and brighten and their connections light up; all nodes drift by depth. The loop runs only
 * while something is moving and the hero is on screen. On touch screens and under reduced motion
 * it paints once and stops.
 */
export function NeuralField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { enabled, x, y, px, py, inside } = useHeroPointer();

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    let network = buildNetwork(1, 1);
    let frame = 0;
    let last = 0;
    let visible = true;

    function paint() {
      const { nodes, links } = network;
      context!.clearRect(0, 0, element!.clientWidth, element!.clientHeight);
      context!.lineWidth = 1;
      for (const [i, j] of links) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        context!.strokeStyle = `rgba(63, 213, 245, ${linkAlpha(a.glow, b.glow)})`;
        context!.beginPath();
        context!.moveTo(a.x, a.y);
        context!.lineTo(b.x, b.y);
        context!.stroke();
      }
      for (const node of nodes) {
        context!.fillStyle = `rgba(156, 239, 255, ${nodeAlpha(node.depth, node.glow)})`;
        context!.beginPath();
        context!.arc(node.x, node.y, nodeRadius(node.depth, node.glow), 0, Math.PI * 2);
        context!.fill();
      }
    }

    function step(now: number) {
      frame = 0;
      // Easing by elapsed time keeps the motion identical at any frame rate.
      const elapsed = frameElapsed(now, last);
      last = now;
      const follow = easing(elapsed, MOVE_TAU);
      const fade = easing(elapsed, GLOW_TAU);
      const input = {
        pointerX: px.get(),
        pointerY: py.get(),
        on: inside.get() === 1,
        driftX: x.get(),
        driftY: y.get(),
      };
      let moving = input.on;
      let energy = 0;

      for (const node of network.nodes) {
        const remaining = stepNode(node, input, follow, fade);
        energy += node.glow;
        if (remaining > 0.02) moving = true;
      }
      paint();
      element!.dataset.energy = energy.toFixed(1);
      if (moving && visible) frame = requestAnimationFrame(step);
    }

    const wake = () => {
      if (!enabled || !visible || frame) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const { clientWidth: width, clientHeight: height } = element!;
      element!.width = Math.round(width * dpr);
      element!.height = Math.round(height * dpr);
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      network = buildNetwork(width, height);
      paint();
    }

    resize();
    const sized = new ResizeObserver(resize);
    sized.observe(element);
    const seen = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) wake();
    });
    seen.observe(element);
    const stops = [px.on("change", wake), inside.on("change", wake), x.on("change", wake)];

    return () => {
      cancelAnimationFrame(frame);
      sized.disconnect();
      seen.disconnect();
      for (const stop of stops) stop();
    };
  }, [enabled, x, y, px, py, inside]);

  return (
    <canvas ref={canvas} aria-hidden="true" className="neural-field" data-testid="neural-field" />
  );
}
