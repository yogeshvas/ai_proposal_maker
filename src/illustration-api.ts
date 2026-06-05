import { getLlmSvg } from "./services/svg-llm.service.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

interface FourierComponent {
  re: number; im: number; freq: number; amp: number; phase: number;
}

interface LlmSvgRequest {
  concept: string; width?: number; height?: number;
}

interface FourierSvgRequest {
  shape: "growth_arrow" | "gear" | "person_running" | "star" | "heart" | "chart_bars";
  numComponents?: number;
}

interface SvgResponse {
  staticSvg: string;
  animatedHtml: string;
  usedFallback?: boolean;
  fallbackReason?: string;
}

// ─── Preset Shape Generators ──────────────────────────────────────────────────

const SHAPE_GROWTH_ARROW: Point[] = [
  { x: 50, y: 380 }, { x: 50, y: 300 }, { x: 120, y: 300 },
  { x: 120, y: 340 }, { x: 190, y: 340 }, { x: 190, y: 260 },
  { x: 260, y: 260 }, { x: 260, y: 310 }, { x: 330, y: 310 },
  { x: 330, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 250 },
  // Arrow head
  { x: 400, y: 100 }, { x: 470, y: 220 }, { x: 430, y: 220 },
  { x: 430, y: 380 }, { x: 50, y: 380 },
];

function generateHeartPoints(n = 80): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push({ x: x * 13 + 250, y: y * 13 + 260 });
  }
  return pts;
}

function generateGearPoints(teeth = 8, outerR = 190, innerR = 140, n = 80): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const phase = (i % (n / teeth)) / (n / teeth);
    const r = phase < 0.5 ? outerR : innerR;
    pts.push({ x: 250 + r * Math.cos(t), y: 250 + r * Math.sin(t) });
  }
  return pts;
}

const SHAPE_PERSON_RUNNING: Point[] = [
  // Head (octagon)
  { x: 280, y: 55 }, { x: 295, y: 65 }, { x: 300, y: 82 },
  { x: 295, y: 99 }, { x: 280, y: 109 }, { x: 265, y: 99 },
  { x: 260, y: 82 }, { x: 265, y: 65 }, { x: 280, y: 55 },
  // Neck + torso
  { x: 278, y: 120 }, { x: 268, y: 175 }, { x: 255, y: 240 },
  // Right arm (forward and up)
  { x: 300, y: 155 }, { x: 345, y: 185 }, { x: 360, y: 210 },
  { x: 300, y: 155 }, { x: 268, y: 175 },
  // Left arm (back and down)
  { x: 225, y: 190 }, { x: 185, y: 230 }, { x: 170, y: 255 },
  { x: 225, y: 190 }, { x: 255, y: 240 },
  // Right leg (forward)
  { x: 285, y: 310 }, { x: 310, y: 390 }, { x: 330, y: 445 },
  { x: 310, y: 390 }, { x: 285, y: 310 }, { x: 255, y: 240 },
  // Left leg (back)
  { x: 230, y: 310 }, { x: 205, y: 385 }, { x: 190, y: 440 },
];

function generateStarPoints(outerR = 210, innerR = 85): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({ x: 250 + r * Math.cos(angle), y: 250 + r * Math.sin(angle) });
  }
  return pts;
}

const SHAPE_CHART_BARS: Point[] = [
  // Baseline
  { x: 40, y: 420 }, { x: 450, y: 420 },
  // Axis
  { x: 40, y: 420 }, { x: 40, y: 50 },
  // Back to base, then bar 1 (short)
  { x: 40, y: 420 }, { x: 70, y: 420 }, { x: 70, y: 340 }, { x: 140, y: 340 }, { x: 140, y: 420 },
  // Bar 2 (medium)
  { x: 170, y: 420 }, { x: 170, y: 230 }, { x: 240, y: 230 }, { x: 240, y: 420 },
  // Bar 3 (tall)
  { x: 270, y: 420 }, { x: 270, y: 100 }, { x: 340, y: 100 }, { x: 340, y: 420 },
  // Bar 4 (tallest + arrow)
  { x: 370, y: 420 }, { x: 370, y: 60 },
  // Arrow head on bar 4
  { x: 350, y: 90 }, { x: 370, y: 40 }, { x: 390, y: 90 }, { x: 370, y: 60 },
];

const SHAPES: Record<FourierSvgRequest["shape"], Point[]> = {
  growth_arrow: SHAPE_GROWTH_ARROW,
  heart: generateHeartPoints(),
  gear: generateGearPoints(),
  person_running: SHAPE_PERSON_RUNNING,
  star: generateStarPoints(),
  chart_bars: SHAPE_CHART_BARS,
};

// ─── DFT ──────────────────────────────────────────────────────────────────────

function dft(points: Point[]): FourierComponent[] {
  const N = points.length;
  const components: FourierComponent[] = [];

  for (let k = 0; k < N; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const phi = (2 * Math.PI * k * n) / N;
      re += points[n]!.x * Math.cos(phi) + points[n]!.y * Math.sin(phi);
      im += -points[n]!.x * Math.sin(phi) + points[n]!.y * Math.cos(phi);
    }
    re /= N; im /= N;
    components.push({
      re, im,
      freq: k,
      amp: Math.sqrt(re * re + im * im),
      phase: Math.atan2(im, re),
    });
  }

  return components.sort((a, b) => b.amp - a.amp);
}

// ─── Static SVG (server-side path reconstruction) ─────────────────────────────

function buildStaticSvg(components: FourierComponent[], width = 500, height = 500): string {
  const steps = 300;
  const raw: Point[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    let x = 0, y = 0;
    for (const c of components) {
      x += c.amp * Math.cos(c.freq * t + c.phase);
      y += c.amp * Math.sin(c.freq * t + c.phase);
    }
    raw.push({ x, y });
  }

  const minX = Math.min(...raw.map(p => p.x));
  const maxX = Math.max(...raw.map(p => p.x));
  const minY = Math.min(...raw.map(p => p.y));
  const maxY = Math.max(...raw.map(p => p.y));
  const pad = 24;
  const rX = maxX - minX || 1;
  const rY = maxY - minY || 1;

  const pts = raw.map(p => ({
    x: pad + ((p.x - minX) / rX) * (width - 2 * pad),
    y: pad + ((p.y - minY) / rY) * (height - 2 * pad),
  }));

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${d}" fill="none" stroke="#111111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ─── Fourier Animated HTML (client-side canvas) ────────────────────────────────

function buildFourierAnimatedHtml(components: FourierComponent[], staticSvg: string): string {
  const json = JSON.stringify(components);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Fourier Drawing Machine</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0d0d1a; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 20px; font-family: monospace; color: #aaa; }
  canvas { border-radius: 8px; box-shadow: 0 0 40px rgba(0,200,180,0.15); }
  .label { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.5; }
  .static-wrap { background: #fff; border-radius: 8px; padding: 16px; }
</style>
</head>
<body>
<div class="label">Fourier Drawing Machine — Epicycle Animation</div>
<canvas id="c" width="560" height="560"></canvas>
<div class="label">Static SVG (for PDF embed)</div>
<div class="static-wrap">${staticSvg}</div>
<script>
const COMPONENTS = ${json};
const W = 560, H = 560;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const tracedPath = [];
let time = 0;
const dt = (2 * Math.PI) / 480;

function drawEpicycles(cx, cy, comps, t) {
  let x = cx, y = cy;
  for (const c of comps) {
    const px = x, py = y;
    const angle = c.freq * t + c.phase;
    x += c.amp * Math.cos(angle);
    y += c.amp * Math.sin(angle);

    // circle
    ctx.beginPath();
    ctx.arc(px, py, c.amp, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(80,120,255,0.18)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // spoke
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(140,160,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  return { x, y };
}

function frame() {
  ctx.fillStyle = 'rgba(13,13,26,0.18)';
  ctx.fillRect(0, 0, W, H);

  const { x, y } = drawEpicycles(W / 2, H / 2, COMPONENTS, time);

  tracedPath.push({ x, y });
  if (tracedPath.length > 2400) tracedPath.shift();

  if (tracedPath.length > 1) {
    ctx.beginPath();
    ctx.moveTo(tracedPath[0].x, tracedPath[0].y);
    for (let i = 1; i < tracedPath.length; i++) ctx.lineTo(tracedPath[i].x, tracedPath[i].y);
    ctx.strokeStyle = '#00e8c8';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // glowing tip
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  time += dt;
  requestAnimationFrame(frame);
}
frame();
</script>
</body>
</html>`;
}

// ─── LLM Animated HTML wrapper (for the standalone API endpoint) ──────────────

function buildLlmAnimatedHtml(staticSvg: string, w: number, h: number): string {
  const inner = staticSvg
    .replace(/^<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" id="drawing" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`)
    .replace(/<path /, '<path id="p" ');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>LLM Line Art</title>
<style>
  * { margin: 0; padding: 0; }
  body { background: #f7f7f5; display: flex; align-items: center; justify-content: center; height: 100vh; }
  #drawing { filter: drop-shadow(0 4px 12px rgba(0,0,0,0.12)); }
  #p { stroke-dasharray: 10000; stroke-dashoffset: 10000; animation: draw 3.8s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
</style>
</head>
<body>
${inner}
<script>
  const p = document.getElementById('p');
  const len = p.getTotalLength();
  p.style.strokeDasharray = len;
  p.style.strokeDashoffset = len;
  p.getBoundingClientRect();
  p.style.animation = 'draw 3.8s cubic-bezier(0.4,0,0.2,1) forwards';
</script>
</body>
</html>`;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function handleFourierSvg(req: Request): Promise<Response> {
  let body: FourierSvgRequest;
  try { body = await req.json() as FourierSvgRequest; }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS }); }

  const valid = ["growth_arrow", "gear", "person_running", "star", "heart", "chart_bars"];
  if (!body.shape || !valid.includes(body.shape)) {
    return Response.json(
      { error: `shape must be one of: ${valid.join(", ")}` },
      { status: 400, headers: CORS }
    );
  }

  const numComponents = Math.min(Math.max(body.numComponents ?? 20, 5), 100);
  const points = SHAPES[body.shape];
  const components = dft(points).slice(0, numComponents);
  const staticSvg = buildStaticSvg(components);
  const animatedHtml = buildFourierAnimatedHtml(components, staticSvg);

  return Response.json({ staticSvg, animatedHtml } satisfies SvgResponse, { headers: CORS });
}

async function handleLlmSvg(req: Request): Promise<Response> {
  let body: LlmSvgRequest;
  try { body = await req.json() as LlmSvgRequest; }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS }); }

  if (!body.concept?.trim()) {
    return Response.json({ error: "concept is required" }, { status: 400, headers: CORS });
  }

  const w = Math.min(Math.max(body.width ?? 400, 100), 1000);
  const h = Math.min(Math.max(body.height ?? 400, 100), 1000);

  const staticSvg = await getLlmSvg(body.concept.trim(), w, h);
  const animatedHtml = buildLlmAnimatedHtml(staticSvg, w, h);

  return Response.json({ staticSvg, animatedHtml } satisfies SvgResponse, { headers: CORS });
}

// ─── Server ───────────────────────────────────────────────────────────────────

Bun.serve({
  port: 3001,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", port: 3001, endpoints: ["/generate-svg/llm", "/generate-svg/fourier"] }, { headers: CORS });
    }

    if (req.method === "POST" && url.pathname === "/generate-svg/fourier") return handleFourierSvg(req);
    if (req.method === "POST" && url.pathname === "/generate-svg/llm") return handleLlmSvg(req);

    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  },
});

console.log("Illustration API → http://localhost:3001");
console.log("  POST /generate-svg/fourier  { shape, numComponents? }");
console.log("  POST /generate-svg/llm      { concept, width?, height? }");
