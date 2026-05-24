import type { Vec2 } from "../types";

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, amount: number): Vec2 {
  return { x: v.x * amount, y: v.y * amount };
}

export function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function normalize(v: Vec2): Vec2 {
  const length = magnitude(v);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / length, y: v.y / length };
}

export function distance(a: Vec2, b: Vec2): number {
  return magnitude(subtract(a, b));
}

export function fromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function wrapAngle(angle: number): number {
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  return angle;
}
