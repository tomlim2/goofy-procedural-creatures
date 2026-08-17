// 손그림 선을 three.js 지오메트리로 만든다.
//
// 선을 Line으로 그리면 굵기를 못 준다(WebGL의 linewidth는 대부분 1로 고정된다).
// 그래서 모든 획을 리본 메시로 만든다. 정점을 노이즈로 밀고, 진행 방향의
// 법선으로 폭을 벌린다. 폭이 일정하지 않아야 펜처럼 보인다.

import * as THREE from "three";
// 정점 색은 hexToRgb(선형 공간)를 거친다 — color.js. 우회하지 않는다 (guidelines/drawing.md § 색은 선형 공간으로 넣는다)
import { hexToRgb } from "./color.js";

// 획을 일정 간격으로 다시 찍는다. 이걸 안 하면 노이즈가 긴 구간에서만 먹는다.
function resample(points, step) {
  if (points.length < 2) return points.slice();
  const out = [points[0]];
  let carry = 0;

  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;

    let travelled = carry;
    while (travelled + step <= length) {
      travelled += step;
      const t = travelled / length;
      out.push([ax + dx * t, ay + dy * t]);
    }
    carry = travelled - length;
  }

  out.push(points[points.length - 1]);
  return out;
}

// 법선 방향으로 밀어 손떨림을 만든다.
// 저주파(전체가 휘는 것)와 고주파(잔떨림)를 겹쳐야 사람 손처럼 보인다.
function perturb(points, noise, amount, phase) {
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let nx = -(next[1] - prev[1]);
    let ny = next[0] - prev[0];
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;

    const slow = noise(phase + i * 0.09);
    const fast = noise(phase * 1.7 + i * 0.62) * 0.35;
    const push = (slow + fast) * amount;
    out.push([x + nx * push, y + ny * push]);
  }
  return out;
}

export class Sketch {
  // inkScale은 획 굵기 전역 배율이다. 셀 크기를 바꾸면 여기만 손대면 된다.
  constructor(noise, wobble = 1, inkScale = 1.5) {
    this.noise = noise;
    this.wobble = wobble;
    this.inkScale = inkScale;
    this.positions = [];
    this.colors = [];
    this.phase = 0;
  }

  triangle(ax, ay, bx, by, cx, cy, rgb) {
    this.positions.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
    for (let i = 0; i < 3; i += 1) this.colors.push(rgb[0], rgb[1], rgb[2]);
  }

  // 하나의 획. width는 최대 폭이고 끝으로 갈수록 얇아진다.
  stroke(points, { color = "#2b2724", width = 0.012, jitter = 0.006, passes = 1, step = 0.03 } = {}) {
    const rgb = hexToRgb(color);
    width *= this.inkScale;

    for (let pass = 0; pass < passes; pass += 1) {
      this.phase += 13.37;
      const sampled = resample(points, step);
      if (sampled.length < 2) continue;
      // 표본이 양끝 둘뿐인 짧은 획(step보다 짧은 점·주근깨·세로 동공)은 끝 가늘어짐 때문에 폭이 0이 되어 사라진다.
      // 가운데 표본을 하나 넣어 그 자리에서 제 폭을 갖게 한다 — 짧은 획은 작은 콩알로 남는다.
      if (sampled.length === 2) sampled.splice(1, 0, [(sampled[0][0] + sampled[1][0]) / 2, (sampled[0][1] + sampled[1][1]) / 2]);
      const path = perturb(sampled, this.noise, jitter * this.wobble, this.phase);
      // 끝을 가늘게, 중간을 두껍게(taper). 여기에 노이즈로 필압 변화를 얹는다(press).
      const phase = this.phase;
      const noise = this.noise;
      const taper = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.35);
      const press = (t, k) => 0.75 + 0.45 * noise(phase * 0.5 + t * 6 + k);
      const last = path.length - 1;

      for (let i = 1; i < path.length; i += 1) {
        const [ax, ay] = path[i - 1];
        const [bx, by] = path[i];
        let dx = bx - ax;
        let dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        dx /= length;
        dy /= length;

        const t0 = (i - 1) / last;
        const t1 = i / last;
        const w0 = (width * taper(t0) * press(t0, 0)) / 2;
        const w1 = (width * taper(t1) * press(t1, 1)) / 2;

        const nx = -dy;
        const ny = dx;
        const a1 = [ax + nx * w0, ay + ny * w0];
        const a2 = [ax - nx * w0, ay - ny * w0];
        const b1 = [bx + nx * w1, by + ny * w1];
        const b2 = [bx - nx * w1, by - ny * w1];

        this.triangle(a1[0], a1[1], a2[0], a2[1], b1[0], b1[1], rgb);
        this.triangle(a2[0], a2[1], b2[0], b2[1], b1[0], b1[1], rgb);
      }
    }
  }

  // 닫힌 획. 머리와 몸의 외곽선에 쓴다.
  outline(points, options = {}) {
    this.stroke([...points, points[0]], options);
  }

  // 면 채우기. 중심에서 부채꼴로 자른다.
  // 우리가 쓰는 도형은 전부 중심에서 보이는 형태라 이걸로 충분하다.
  fill(points, color, offset = [0, 0]) {
    const rgb = hexToRgb(color);
    let cx = 0;
    let cy = 0;
    for (const [x, y] of points) {
      cx += x;
      cy += y;
    }
    cx /= points.length;
    cy /= points.length;

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.triangle(
        cx + offset[0], cy + offset[1],
        a[0] + offset[0], a[1] + offset[1],
        b[0] + offset[0], b[1] + offset[1],
        rgb
      );
    }
  }

  // 머리카락. 면을 칠하지 않고 펜으로 왕복해 긋는다.
  // 레퍼런스의 머리가 이 방식이라 스크리블이 따로 필요하다.
  scribble(points, { color = "#2b2724", passes = 14, width = 0.009, spread = 0.05 } = {}) {
    for (let i = 0; i < passes; i += 1) {
      this.phase += 7.77;
      const t = i / Math.max(1, passes - 1);
      // 안쪽(얼굴 쪽)으로 퍼지는 폭을 줄인다. 머리카락은 바깥으로 뻗는다.
      const drift = (this.noise(this.phase * 0.3) * 0.4 + (t * 0.85 - 0.25)) * spread;
      const shifted = points.map(([x, y], index) => {
        const wave = this.noise(this.phase * 0.2 + index * 0.4) * spread * 0.4;
        return [x + drift * 0.4 + wave * 0.3, y + drift + wave];
      });
      this.stroke(shifted, { color, width, jitter: 0.012, step: 0.045 });
    }
  }

  // 스크리블 채움. 타원 내부를 지그재그 한 획으로 왕복해 덮는다.
  // 플랫 채색과 달리 획 방향이 보인다. 연필로 칠한 면의 정체가 이거다.
  scribbleFill(cx, cy, rx, ry, { color, angle = 0, gap = 0.03, width = 0.007 } = {}) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const local = [];
    let dir = 1;
    for (let v = -ry + gap * 0.6; v < ry; v += gap) {
      const half = rx * Math.sqrt(Math.max(0, 1 - (v * v) / (ry * ry)));
      local.push([-half * dir, v], [half * dir, v]);
      dir = -dir;
    }
    if (local.length < 4) return;
    const world = local.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
    this.phase += 3.3;
    this.stroke(world, { color, width, jitter: 0.01, step: 0.05 });
  }

  // 빗금 음영. 볼이나 이마의 그늘에 쓴다.
  hatch(cx, cy, rx, ry, angle, { color = "#3a3430", lines = 6, width = 0.006 } = {}) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = 0; i < lines; i += 1) {
      const t = lines === 1 ? 0 : (i / (lines - 1)) * 2 - 1;
      const half = Math.sqrt(Math.max(0, 1 - t * t));
      const u = t * ry;
      const ax = cx + (-half * rx) * cos - u * sin;
      const ay = cy + (-half * rx) * sin + u * cos;
      const bx = cx + half * rx * cos - u * sin;
      const by = cy + half * rx * sin + u * cos;
      this.stroke([[ax, ay], [bx, by]], { color, width, jitter: 0.01, step: 0.05 });
    }
  }

  build() {
    return buildGeometry([this]);
  }

  get empty() {
    return this.positions.length === 0;
  }
}

// 스케치 여러 벌을 지오메트리 하나로. 앞의 것이 먼저 그려져 밑에 깔린다 — 채색 스케치 다음 잉크 스케치를 주면 한 메시로 한 층이 된다.
// depthTest 없이 정점 순서가 곧 앞뒤라 스케치 안·스케치 사이 순서가 그대로 겹침 순서다
export function buildGeometry(sketches) {
  const filled = sketches.filter((s) => !s.empty);
  const count = filled.reduce((n, s) => n + s.positions.length, 0);
  const positions = new Float32Array(count);
  const colors = new Float32Array(count);
  let offset = 0;
  for (const s of filled) {
    positions.set(s.positions, offset);
    colors.set(s.colors, offset);
    offset += s.positions.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// 불규칙한 폐곡선. 레퍼런스의 머리는 원이 아니라 울퉁불퉁한 덩어리다.
//
// square: superellipse 지수 증가분. 0이면 타원, 1.5쯤이면 모서리 둥근 사각.
// taper: 위아래 폭 비율. +면 아래가 넓고(서양배), -면 위가 넓다.
export function blobPath(cx, cy, rx, ry, { lumps = 5, amount = 0.08, noise, phase = 0, steps = 48, square = 0, taper = 0 } = {}) {
  const n = 2 + square;
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const c = Math.cos(angle);
    const sSin = Math.sin(angle);
    const ux = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const uy = Math.sign(sSin) * Math.pow(Math.abs(sSin), 2 / n);
    const widen = 1 - taper * uy;
    const lumpiness = noise ? noise(phase + c * lumps + sSin * lumps) : 0;
    const r = 1 + lumpiness * amount;
    points.push([cx + ux * rx * widen * r, cy + uy * ry * r]);
  }
  return points;
}

export function arcPath(cx, cy, rx, ry, from, to, steps = 16) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = from + ((to - from) * i) / steps;
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  return points;
}
