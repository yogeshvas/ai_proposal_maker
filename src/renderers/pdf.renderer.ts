import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import type { Slide, LayoutType, FlowNode, ChartBar, Phase } from "./slide.types";

const OUTPUT_DIR = path.resolve(process.cwd(), "generated");

// ─── LAYOUTS WITH PHOTOS ───────────────────────────────────────────────────────
// Only cover (hero) and closing (quote_image) fetch Unsplash photos.
// image_left / image_right are used when AI explicitly picks them for case studies.
// text_flow, text_chart, and all diagram layouts never fetch photos.
const PHOTO_LAYOUTS = new Set(["hero", "image_left", "image_right", "quote_image"]);

const VALID_LAYOUTS = new Set<string>([
  "hero", "image_right", "image_left", "two_column",
  "metrics", "timeline", "architecture", "comparison", "minimal",
  "icon_grid", "challenge_grid", "flow_kpi", "numbered_steps_callout",
  "process_donut", "staggered_phases", "tech_ecosystem",
  "text_chart", "text_flow", "quote_image",
]);

const SLIDE_TYPE_FALLBACK: Record<string, LayoutType> = {
  cover:                    "hero",
  market_opportunity:       "text_flow",
  client_challenges:        "challenge_grid",
  solution_overview:        "flow_kpi",
  product_capabilities:     "icon_grid",
  technical_architecture:   "tech_ecosystem",
  business_impact:          "process_donut",
  implementation_timeline:  "staggered_phases",
  pricing:                  "minimal",
  call_to_action:           "quote_image",
  // AI variants
  executive:                "text_flow",
  executive_summary:        "text_flow",
  executive_slide:          "text_flow",
  hidden_costs:             "challenge_grid",
  use_cases:                "numbered_steps_callout",
  integration:              "tech_ecosystem",
  roi:                      "flow_kpi",
  competitive_advantage:    "comparison",
  case_study:               "image_left",
  closing:                  "quote_image",
  chapter_intro:            "minimal",
};

function resolveLayout(slide: Slide): LayoutType {
  if (slide.recommendedLayout && VALID_LAYOUTS.has(slide.recommendedLayout)) {
    // Always use staggered_phases for implementation_timeline — overrides AI picking "timeline"
    if (slide.slideType === "implementation_timeline" && slide.recommendedLayout === "timeline") {
      return "staggered_phases";
    }
    return slide.recommendedLayout as LayoutType;
  }
  // Alternate text_flow / text_chart for market_opportunity by slide number
  if (slide.slideType === "market_opportunity") {
    return (slide.slideNumber ?? 0) % 2 === 0 ? "text_chart" : "text_flow";
  }
  return SLIDE_TYPE_FALLBACK[slide.slideType] ?? "minimal";
}

// ─── UTILITIES ─────────────────────────────────────────────────────────────────
function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseBullet(text: string): { title: string; desc: string } {
  const idx = text.indexOf(": ");
  if (idx > 2 && idx < 65) {
    return { title: cap(text.slice(0, idx)), desc: cap(text.slice(idx + 2)) };
  }
  return { title: "", desc: cap(text) };
}

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function label(tag?: string): string {
  if (!tag) return "";
  return `<p class="label">${esc(tag)}</p>`;
}

function parsePercent(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : Math.abs(n);
}

// ─── INLINE SVG ICONS (Lucide-style, 24×24 viewBox) ──────────────────────────
const ICONS: Record<string, string> = {
  smartphone:        `<path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
  users:             `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  zap:               `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  shield:            `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  "message-circle":  `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  "check-circle":    `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  clock:             `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  "trending-up":     `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  database:          `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
  lock:              `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  globe:             `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  headphones:        `<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>`,
  "dollar-sign":     `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
  "refresh-cw":      `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  layers:            `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
  cpu:               `<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>`,
  bell:              `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  settings:          `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  "bar-chart":       `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  star:              `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  "arrow-right":     `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
  "chevron-right":   `<polyline points="9 18 15 12 9 6"/>`,
  check:             `<polyline points="20 6 9 17 4 12"/>`,
  phone:             `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.79 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.7 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.27a16 16 0 0 0 6.29 6.29l1.04-1.04a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`,
  mail:              `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
  send:              `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,
  user:              `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  "user-check":      `<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>`,
  "credit-card":     `<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
  "trending-down":   `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>`,
  "bar-chart-2":     `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  "pie-chart":       `<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>`,
  server:            `<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>`,
  cloud:             `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>`,
  wifi:              `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`,
  "shield-check":    `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>`,
  calendar:          `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  clipboard:         `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>`,
  "file-text":       `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
  target:            `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  activity:          `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  "alert-triangle":  `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  inbox:             `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
  "message-square":  `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
};

const ICON_POOL = [
  "message-circle", "users", "zap", "shield", "check-circle",
  "trending-up", "database", "lock", "globe", "headphones",
  "dollar-sign", "refresh-cw", "layers", "cpu", "bell",
  "settings", "bar-chart", "star", "smartphone", "clock",
  "phone", "mail", "send", "user-check", "credit-card",
  "server", "cloud", "wifi", "shield-check", "calendar",
  "clipboard", "file-text", "target", "activity", "inbox",
  "message-square", "pie-chart", "trending-down", "alert-triangle", "check",
];

function icon(name: string, size = 20): string {
  const paths = ICONS[name] ?? ICONS["star"];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// ─── SVG CHART HELPERS ─────────────────────────────────────────────────────────

// Split a label into at most 2 short lines for SVG rendering
function svgLines(text: string, maxChars = 14): [string, string?] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  let line1 = "";
  let line2 = "";
  let filling = 1;
  for (const w of words) {
    if (filling === 1) {
      if ((line1 + " " + w).trim().length <= maxChars) {
        line1 = (line1 + " " + w).trim();
      } else {
        filling = 2;
        line2 = w;
      }
    } else {
      line2 = (line2 + " " + w).trim();
    }
  }
  return line2 ? [line1, line2.slice(0, maxChars)] : [line1];
}

function renderDonutChart(percent: number, valueLabel: string, descLabel: string): string {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(percent, 0), 100);
  const dash = (pct / 100) * circ;
  const gap = circ - dash;
  // Auto-size font: shorter = bigger
  const vLen = valueLabel.length;
  const vFs = vLen <= 4 ? 22 : vLen <= 7 ? 17 : vLen <= 10 ? 14 : 11;
  // If label is long, split into 2 lines
  const vLines = svgLines(valueLabel, 8);
  const vY1 = vLines.length > 1 ? 66 : 74;
  const vY2 = vY1 + vFs + 2;
  return `<div class="donut-wrap">
  <svg viewBox="0 0 140 140" width="130" height="130">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="11"/>
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="#111111" stroke-width="11"
      stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
      stroke-dashoffset="${(circ * 0.25).toFixed(1)}"
      stroke-linecap="round"/>
    <text x="70" y="${vY1}" text-anchor="middle" font-size="${vFs}" font-weight="800" fill="#111111">${esc(vLines[0] ?? "")}</text>
    ${vLines[1] ? `<text x="70" y="${vY2}" text-anchor="middle" font-size="${vFs}" font-weight="800" fill="#111111">${esc(vLines[1])}</text>` : ""}
  </svg>
  <p class="donut-label">${esc(cap(descLabel))}</p>
</div>`;
}

function renderBarChart(bars: ChartBar[]): string {
  if (!bars || bars.length === 0) return "";
  const max = Math.max(...bars.map(b => b.value), 1);
  // Generate shades: higher value = darker
  const shades = ["#111111", "#374151", "#4B5563", "#6B7280", "#9CA3AF", "#D1D5DB"];
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  const rankMap = new Map(sorted.map((b, i) => [b.label, i]));
  return `<div class="bar-chart">
  <div class="bar-chart-inner">
    <div class="bar-y-label">Channel</div>
    <div class="bar-rows">
      ${bars.map(b => {
        const pct = Math.round((b.value / max) * 100);
        const rank = rankMap.get(b.label) ?? 0;
        const shade = shades[Math.min(rank, shades.length - 1)] ?? "#111111";
        return `<div class="bar-row">
          <span class="bar-lbl">${esc(b.label)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${shade}">
              <span class="bar-inner-val">${b.value}%</span>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
    <div class="bar-x-axis">
      <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
    </div>
    <p class="bar-x-label">Avg. Open Rate (%)</p>
  </div>
</div>`;
}

function renderFlowNodes(nodes: FlowNode[], large = false): string {
  if (!nodes || nodes.length === 0) return "";
  const sz = large ? 32 : 20;
  const cls = large ? "flow-row large" : "flow-row";
  const parts: string[] = [];
  nodes.forEach((n, i) => {
    const icoName = n.icon ?? "check-circle";
    parts.push(`<div class="flow-node">
      <div class="flow-circle">${icon(icoName, sz)}</div>
      <p class="flow-node-label">${esc(n.label)}</p>
      ${n.sublabel ? `<p class="flow-node-sub">${esc(n.sublabel)}</p>` : ""}
    </div>`);
    if (i < nodes.length - 1) {
      parts.push(`<div class="flow-arrow">${icon("chevron-right", large ? 28 : 18)}</div>`);
    }
  });
  return `<div class="${cls}">${parts.join("")}</div>`;
}

// Curved alternating-arc flow (semicircle arcs connecting numbered circles)
function renderCurvedArcFlow(nodes: FlowNode[]): string {
  if (!nodes || nodes.length === 0) return "";
  const n = Math.min(nodes.length, 5);
  // Wide canvas — more room per node = labels won't overlap
  const W = 960, H = 170;
  const r = 34;
  const spacing = W / (n + 1);
  const cy = H / 2;

  let paths = "";
  for (let i = 0; i < n - 1; i++) {
    const x1 = spacing * (i + 1) + r;
    const x2 = spacing * (i + 2) - r;
    const midX = (x1 + x2) / 2;
    const arcH = 38;
    const dir = i % 2 === 0 ? -1 : 1; // alternate up/down
    paths += `<path d="M ${x1} ${cy} Q ${midX} ${cy + dir * arcH} ${x2} ${cy}"
      fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-dasharray="5 3"/>`;
  }

  const circles = Array.from({ length: n }, (_, i) => {
    const x = spacing * (i + 1);
    const icoName = nodes[i]?.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    const icoPaths = ICONS[icoName] ?? ICONS["check-circle"] ?? "";
    const labelLines = svgLines(nodes[i]?.label ?? "", 14);
    const subLines = nodes[i]?.sublabel ? svgLines(nodes[i]!.sublabel!, 14) : [];
    const labelY1 = r * 2 + 20;
    const labelY2 = labelY1 + 14;
    const subY = (labelLines.length > 1 ? labelY2 : labelY1) + 14;
    return `<g transform="translate(${x - r},${cy - r})">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1.5"/>
      <svg x="${r - 13}" y="${r - 13}" width="26" height="26" viewBox="0 0 24 24"
        fill="none" stroke="#374151" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        ${icoPaths}
      </svg>
      <text x="${r}" y="${labelY1}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[0])}</text>
      ${labelLines[1] ? `<text x="${r}" y="${labelY2}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[1])}</text>` : ""}
      ${subLines[0] ? `<text x="${r}" y="${subY}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="Inter,sans-serif">${esc(subLines[0])}</text>` : ""}
    </g>`;
  }).join("");

  const totalH = H + 70;
  return `<div class="curved-arc-flow">
  <svg viewBox="0 0 ${W} ${totalH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    ${paths}
    ${circles}
  </svg>
</div>`;
}

// ─── LAYOUT RENDERERS ──────────────────────────────────────────────────────────

// ── COVER (hero) ───────────────────────────────────────────────────────────────
function renderHero(slide: Slide): string {
  return `<div class="slide cover">
  <div class="cover-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
  <div class="cover-body">
    <div class="cover-inner">
      ${label(slide.headerTag)}
      <h1 class="cover-title">${esc(slide.title ?? "")}</h1>
      <div class="cover-rule"></div>
      ${slide.subtitle ? `<p class="cover-subtitle">${esc(slide.subtitle)}</p>` : ""}
      ${slide.description ? `<p class="cover-meta">${esc(slide.description)}</p>` : ""}
    </div>
  </div>
</div>`;
}

// ── IMAGE LEFT ─────────────────────────────────────────────────────────────────
function renderImageLeft(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  return `<div class="slide il">
  <div class="il-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
  <div class="il-body">
    ${label(slide.headerTag)}
    <h2 class="section-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="body-text italic">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? `<ul class="arrow-list">
      ${bullets.map(b => `<li>${esc(cap(b))}</li>`).join("")}
    </ul>` : ""}
  </div>
</div>`;
}

// ── IMAGE RIGHT ────────────────────────────────────────────────────────────────
function renderImageRight(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  return `<div class="slide ir">
  <div class="ir-body">
    ${label(slide.headerTag)}
    <h2 class="section-title">${esc(slide.title ?? "")}</h2>
    <div class="rule"></div>
    ${slide.subtitle ? `<p class="body-text italic">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? `<div class="inline-rows">
      ${bullets.map(b => {
        const p = parseBullet(b);
        return `<div class="inline-row">${p.title ? `<strong>${esc(p.title)}</strong> — ` : ""}${esc(p.desc)}</div>`;
      }).join("")}
    </div>` : ""}
  </div>
  <div class="ir-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
</div>`;
}

// ── TWO COLUMN (clean white, no dark header) ────────────────────────────────────
function renderTwoColumn(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  return `<div class="slide two-col">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="feat-grid">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      return `<div class="feat-card">
        <span class="feat-card-num">0${i + 1}</span>
        ${p.title ? `<p class="feat-title">${esc(p.title)}</p>` : ""}
        <p class="feat-desc">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
</div>`;
}

// ── ARCHITECTURE (clean white, accent border sidebar) ──────────────────────────
function renderArchitecture(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  return `<div class="slide arch">
  <div class="arch-sidebar">
    ${label(slide.headerTag)}
    <h2 class="arch-sidebar-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="arch-sidebar-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="arch-main">
    <div class="feat-rows">
      ${bullets.map((b, i) => {
        const p = parseBullet(b);
        return `<div class="feat-row">
          <span class="feat-row-num">${String(i + 1).padStart(2, "0")}</span>
          <div class="feat-row-content">
            ${p.title ? `<p class="feat-row-title">${esc(p.title)}</p>` : ""}
            <p class="feat-row-desc">${esc(p.desc)}</p>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
</div>`;
}

// ── COMPARISON ─────────────────────────────────────────────────────────────────
function renderComparison(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  const half = Math.ceil(bullets.length / 2);
  const left = bullets.slice(0, half);
  const right = bullets.slice(half);
  const parts = slide.subtitle?.includes("|")
    ? slide.subtitle.split("|").map(s => s.trim())
    : [slide.subtitle ?? "Current State", "With Our Solution"];
  const [leftTitle, rightTitle] = parts;
  return `<div class="slide comparison">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="comp-grid">
    <div class="comp-col left-panel">
      <p class="comp-col-title">${esc(leftTitle ?? "")}</p>
      ${left.map(b => {
        const p = parseBullet(b);
        return `<div class="comp-row"><span class="comp-arrow">→</span><div>${p.title ? `<strong>${esc(p.title)}</strong> — ` : ""}${esc(p.desc)}</div></div>`;
      }).join("")}
    </div>
    <div class="comp-col right-panel">
      <p class="comp-col-title">${esc(rightTitle ?? "")}</p>
      ${right.map(b => {
        const p = parseBullet(b);
        return `<div class="comp-row"><span class="comp-arrow">→</span><div>${p.title ? `<strong>${esc(p.title)}</strong> — ` : ""}${esc(p.desc)}</div></div>`;
      }).join("")}
    </div>
  </div>
</div>`;
}

// ── METRICS ────────────────────────────────────────────────────────────────────
function renderMetrics(slide: Slide): string {
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 4);
  const descs = (slide.bulletPoints ?? []).filter(Boolean);
  const imageRight = (slide.slideNumber ?? 0) % 2 !== 0;
  return `<div class="slide metrics-slide${imageRight ? " reverse" : ""}">
  ${slide.imageUrl ? `<div class="metrics-photo" style="background-image:url('${esc(slide.imageUrl)}')"></div>` : ""}
  <div class="metrics-body">
    ${label(slide.headerTag)}
    <h2 class="section-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="metrics-list">
      ${metrics.map((m, i) => `<div class="metric-item">
        <p class="metric-val">${esc(m.value)}</p>
        <p class="metric-lbl">${esc(cap(m.label))}</p>
        ${descs[i] ? `<p class="metric-desc">${esc(cap(descs[i]))}</p>` : ""}
      </div>`).join("")}
    </div>
  </div>
</div>`;
}

// ── TIMELINE ───────────────────────────────────────────────────────────────────
function renderTimeline(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  return `<div class="slide steps">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="steps-grid">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      return `<div class="step-cell">
        <p class="step-num">0${i + 1}</p>
        <div class="step-rule"></div>
        ${p.title ? `<p class="step-title">${esc(p.title)}</p>` : ""}
        <p class="step-desc">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
</div>`;
}

// ── MINIMAL ────────────────────────────────────────────────────────────────────
function renderMinimal(slide: Slide): string {
  const highlights = (slide.bulletPoints ?? []).filter(Boolean);
  const imageRight = (slide.slideNumber ?? 0) % 2 !== 0;
  return `<div class="slide minimal${imageRight ? " reverse" : ""}">
  ${slide.imageUrl ? `<div class="minimal-photo" style="background-image:url('${esc(slide.imageUrl)}')"></div>` : ""}
  <div class="minimal-body ${!slide.imageUrl ? "no-image" : ""}">
    ${label(slide.headerTag)}
    <h1 class="minimal-title">${esc(slide.title ?? "")}</h1>
    ${slide.subtitle ? `<p class="minimal-sub">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${highlights.length > 0 ? `<div class="highlight-box">
      <p class="highlight-text">${highlights.map(h => esc(cap(h))).join("<br>")}</p>
    </div>` : ""}
  </div>
</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// NEW LAYOUTS
// ══════════════════════════════════════════════════════════════════════════════

// ── ICON GRID ──────────────────────────────────────────────────────────────────
function renderIconGrid(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  const cols = bullets.length <= 4 ? 2 : 3;
  return `<div class="slide icon-grid-slide">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="body-text colored">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="icon-grid cols-${cols}">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const ico = ICON_POOL[i % ICON_POOL.length] ?? "star";
      return `<div class="icon-card">
        <div class="icon-circle">${icon(ico, 20)}</div>
        ${p.title ? `<p class="icon-card-title">${esc(p.title)}</p>` : ""}
        <p class="icon-card-desc">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
</div>`;
}

// Challenge icon pool — alert-style icons for pain points
const CHALLENGE_ICONS = [
  "alert-triangle", "clock", "trending-down", "database",
  "users", "refresh-cw", "lock", "activity",
];

// ── CHALLENGE GRID ─────────────────────────────────────────────────────────────
function renderChallengeGrid(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  const cols = 3; // always 3 columns for 6 cards
  return `<div class="slide challenge-slide">
  <div class="ch-slide-header">
    ${label(slide.headerTag)}
    <h2 class="ch-slide-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="ch-slide-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="challenge-grid cols-${cols}">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const icoName = CHALLENGE_ICONS[i % CHALLENGE_ICONS.length] ?? "alert-triangle";
      return `<div class="challenge-card">
        <div class="ch-card-top">
          <div class="ch-icon-wrap">${icon(icoName, 18)}</div>
          <span class="ch-badge">0${i + 1}</span>
        </div>
        ${p.title ? `<p class="challenge-title">${esc(p.title)}</p>` : ""}
        <p class="challenge-desc">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
</div>`;
}

// ── FLOW + KPI ─────────────────────────────────────────────────────────────────
function renderFlowKpi(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 4);
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 3);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  const flowData: FlowNode[] = nodes.length > 0
    ? nodes
    : bullets.slice(0, 4).map(b => { const p = parseBullet(b); return { label: p.title || p.desc, sublabel: "" }; });

  const nodeCircles = flowData.map((n, i) => {
    const icoName = n.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    return `<div class="fk-node-wrap">
      <div class="fk-node-circle">${icon(icoName, 36)}</div>
      <p class="fk-node-label">${esc(n.label)}</p>
      ${n.sublabel ? `<p class="fk-node-sub">${esc(n.sublabel)}</p>` : ""}
    </div>`;
  });

  const connectors = flowData.length > 1
    ? flowData.slice(0, -1).map(() => `<div class="fk-chevron">${icon("chevron-right", 24)}</div>`)
    : [];

  const flowHtml: string[] = [];
  nodeCircles.forEach((c, i) => {
    flowHtml.push(c);
    if (connectors[i]) flowHtml.push(connectors[i]!);
  });

  return `<div class="slide flow-kpi-slide">
  <div class="fk-left">
    ${label(slide.headerTag)}
    <h2 class="fk-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="fk-subtitle">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="fk-desc">${esc(slide.description)}</p>` : ""}
    <div class="fk-flow-band">
      <div class="fk-nodes-row">${flowHtml.join("")}</div>
    </div>
  </div>
  <div class="fk-right">
    <p class="kpi-heading">Projected Impact</p>
    ${metrics.map((m, i) => `<div class="kpi-row">
      <p class="kpi-val">${esc(m.value)}</p>
      <div class="kpi-text">
        <p class="kpi-lbl">${esc(cap(m.label))}</p>
        ${bullets[i] ? `<p class="kpi-desc">${esc(cap(bullets[i]))}</p>` : ""}
      </div>
    </div>`).join("")}
  </div>
</div>`;
}

// ── NUMBERED STEPS + CALLOUT ───────────────────────────────────────────────────
function renderNumberedStepsCallout(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  const calloutText = slide.description ?? slide.subtitle ?? "";
  return `<div class="slide steps-callout-slide">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="body-text">${esc(slide.subtitle)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="sc-grid">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      return `<div class="sc-cell">
        <p class="sc-num">0${i + 1}</p>
        <div class="sc-rule"></div>
        ${p.title ? `<p class="sc-title">${esc(p.title)}</p>` : ""}
        <p class="sc-desc">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
  ${calloutText ? `<div class="sc-callout">
    <span class="sc-callout-icon">✓</span>
    <p class="sc-callout-text">${esc(calloutText)}</p>
  </div>` : ""}
</div>`;
}

// ── PROCESS + DONUT CHARTS ─────────────────────────────────────────────────────
function renderProcessDonut(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 3);
  const fallbackMetrics = [
    { label: "Efficiency Gain", value: "60%" },
    { label: "Cost Reduction", value: "40%" },
    { label: "Time Saved", value: "75%" },
  ];
  const displayMetrics = metrics.length > 0 ? metrics : fallbackMetrics;
  return `<div class="slide process-donut-slide">
  <div class="pd-left">
    ${label(slide.headerTag)}
    <h2 class="pd-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="pd-desc">${esc(slide.description)}</p>` : ""}
    <div class="pd-steps">
      ${bullets.map((b, i) => {
        const p = parseBullet(b);
        return `<div class="pd-step">
          <span class="pd-step-num">0${i + 1}</span>
          <div>
            ${p.title ? `<p class="pd-step-title">${esc(p.title)}</p>` : ""}
            <p class="pd-step-desc">${esc(p.desc)}</p>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  <div class="pd-right">
    <p class="pd-impact-label">Business Impact</p>
    <div class="pd-donuts">
      ${displayMetrics.map(m => {
        const pct = parsePercent(m.value);
        return renderDonutChart(pct, m.value, m.label);
      }).join("")}
    </div>
  </div>
</div>`;
}

// ── STAGGERED PHASES ───────────────────────────────────────────────────────────
function renderStaggeredPhases(slide: Slide): string {
  // Use phases[] if provided, fallback to bulletPoints
  const phases: Phase[] = (slide.phases ?? []).filter(Boolean).slice(0, 4);
  const fallbackBullets = (slide.bulletPoints ?? []).filter(Boolean);

  // If bulletPoints look like "Phase N: desc", treat each as a phase with a single bullet
  const phaseItems: Phase[] = phases.length > 0 ? phases : fallbackBullets.slice(0, 4).map((b, i) => {
    const p = parseBullet(b);
    const name = p.title || `Phase ${i + 1}`;
    // strip "Phase N" prefix from name if present
    const cleanName = name.replace(/^phase\s+\d+\s*[–-]?\s*/i, "") || name;
    return {
      name: cap(cleanName),
      period: ["Months 1–3", "Months 4–6", "Months 7–10", "Months 11–14"][i] ?? "",
      bullets: p.desc ? p.desc.split(/[.;]/).map(s => s.trim()).filter(Boolean).slice(0, 4) : [],
    };
  });

  return `<div class="slide staggered-slide">
  <div class="staggered-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="staggered-body">
    ${phaseItems.map((ph, i) => `<div class="phase-box phase-${i % 2 === 0 ? "left" : "right"}">
      <p class="phase-name">Phase ${i + 1} — ${esc(ph.name)}</p>
      <p class="phase-period">${esc(ph.period)}</p>
      <ul class="phase-bullets">
        ${(ph.bullets ?? []).slice(0, 4).map(b => `<li>${esc(cap(b))}</li>`).join("")}
      </ul>
    </div>`).join("")}
  </div>
</div>`;
}

// ── TECH ECOSYSTEM ─────────────────────────────────────────────────────────────
function renderTechEcosystem(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  const disclaimer = slide.subtitle ?? "";
  return `<div class="slide tech-slide">
  <div class="white-header">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    <div class="header-rule"></div>
  </div>
  <div class="tech-grid">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const ico = ICON_POOL[i % ICON_POOL.length] ?? "star";
      return `<div class="tech-card">
        <div class="tech-icon">${icon(ico, 40)}</div>
        <p class="tech-category">${esc(p.title.toUpperCase() || `LAYER ${i+1}`)}</p>
        <p class="tech-items">${esc(p.desc)}</p>
      </div>`;
    }).join("")}
  </div>
  ${disclaimer ? `<div class="tech-disclaimer">☐ ${esc(disclaimer)}</div>` : ""}
</div>`;
}

// ── TEXT + BAR CHART ───────────────────────────────────────────────────────────
function renderTextChart(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  const bars: ChartBar[] = (slide.chartBars ?? []).filter(Boolean).slice(0, 6);
  // Fallback bars from metrics if no chartBars
  const chartData = bars.length > 0 ? bars : (slide.metrics ?? []).map(m => ({
    label: m.label,
    value: parsePercent(m.value),
  })).filter(b => b.value > 0);

  return `<div class="slide text-chart-slide">
  <div class="tc-left">
    ${label(slide.headerTag)}
    <h2 class="page-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<p class="body-text colored">${esc(slide.subtitle)}</p>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? `<div class="arrow-list-wrap">
      ${bullets.map(b => {
        const p = parseBullet(b);
        return `<div class="arrow-item">
          <span class="arrow-icon">→</span>
          <div>
            ${p.title ? `<strong>${esc(p.title)}</strong>` : ""}
            ${p.desc ? `<span class="arrow-desc"> ${esc(p.desc)}</span>` : ""}
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}
  </div>
  <div class="tc-right">
    ${chartData.length > 0 ? renderBarChart(chartData) : ""}
  </div>
</div>`;
}

// ── TEXT + FLOW ────────────────────────────────────────────────────────────────
function renderTextFlow(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 5);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  const flowData: FlowNode[] = nodes.length > 0
    ? nodes
    : bullets.slice(0, 4).map(b => { const p = parseBullet(b); return { label: p.title || p.desc, sublabel: p.desc && p.title ? p.desc.split(" ").slice(0, 3).join(" ") : "" }; });

  // Always full-width — photos are only on hero/quote_image layouts
  return `<div class="slide text-flow-slide">
  <div class="tf-top">
    <div class="tf-top-left">
      ${label(slide.headerTag)}
      <h2 class="page-title">${esc(slide.title ?? "")}</h2>
      ${slide.subtitle ? `<p class="body-text colored">${esc(slide.subtitle)}</p>` : ""}
    </div>
    ${slide.description ? `<div class="tf-top-right"><p class="tf-desc">${esc(slide.description)}</p></div>` : ""}
  </div>
  <div class="tf-flow-band">
    ${renderCurvedArcFlow(flowData)}
  </div>
  ${slide.subtitle ? `<p class="tf-foot">${esc(slide.subtitle)}</p>` : ""}
</div>`;
}

// ── QUOTE + IMAGE (closing) ────────────────────────────────────────────────────
function renderQuoteImage(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 3);
  return `<div class="slide quote-image-slide">
  <div class="qi-photo" ${slide.imageUrl ? `style="background-image:url('${esc(slide.imageUrl)}')"` : ""}></div>
  <div class="qi-body">
    ${label(slide.headerTag)}
    <h2 class="qi-title">${esc(slide.title ?? "")}</h2>
    ${slide.subtitle ? `<blockquote class="qi-quote">${esc(slide.subtitle)}</blockquote>` : ""}
    ${slide.description ? `<p class="body-text">${esc(slide.description)}</p>` : ""}
    ${bullets.length > 0 ? `<div class="qi-bullets">
      ${bullets.map(b => `<p class="qi-bullet">${esc(cap(b))}</p>`).join("")}
    </div>` : ""}
    ${slide.headerTag ? `<div class="qi-tags"><span class="qi-tag">${esc(slide.headerTag)}</span><span class="qi-tag">CONFIDENTIAL &amp; PROPRIETARY</span></div>` : ""}
  </div>
</div>`;
}

// ─── RENDERER MAP ──────────────────────────────────────────────────────────────
const RENDERERS: Record<LayoutType, (s: Slide) => string> = {
  hero:                    renderHero,
  image_left:              renderImageLeft,
  image_right:             renderImageRight,
  two_column:              renderTwoColumn,
  metrics:                 renderMetrics,
  timeline:                renderTimeline,
  architecture:            renderArchitecture,
  comparison:              renderComparison,
  minimal:                 renderMinimal,
  icon_grid:               renderIconGrid,
  challenge_grid:          renderChallengeGrid,
  flow_kpi:                renderFlowKpi,
  numbered_steps_callout:  renderNumberedStepsCallout,
  process_donut:           renderProcessDonut,
  staggered_phases:        renderStaggeredPhases,
  tech_ecosystem:          renderTechEcosystem,
  text_chart:              renderTextChart,
  text_flow:               renderTextFlow,
  quote_image:             renderQuoteImage,
};

// ─── CSS ───────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: 13.33in 7.5in; margin: 0; }

html { font-size: 16px; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #1a1a1a;
}

/* ── Slide base ── */
.slide {
  width: 13.33in;
  height: 7.5in;
  overflow: hidden;
  page-break-after: always;
  background: #fff;
  display: flex;
  position: relative;
}

/* ── Shared tokens ── */
.label {
  font-size: 0.65rem;
  font-weight: 600;
  color: #9CA3AF;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}
.page-title {
  font-size: 1.9rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.5rem;
}
.section-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.2;
  margin-bottom: 0.6rem;
}
.body-text {
  font-size: 0.82rem;
  color: #4B5563;
  line-height: 1.65;
  margin-bottom: 0.4rem;
}
.body-text.italic { font-style: italic; }
.body-text.colored { color: #2563EB; font-weight: 500; }
.rule {
  width: 2rem;
  height: 2px;
  background: #E5E7EB;
  margin: 0.7rem 0;
}

/* ── White header (used by many layouts) ── */
.white-header {
  padding: 2rem 2.5rem 1.25rem;
}
.header-rule {
  width: 3rem;
  height: 2px;
  background: #E5E7EB;
  margin-top: 0.75rem;
}

/* ── Arrow list ── */
.arrow-list {
  list-style: none;
  margin-top: 0.75rem;
}
.arrow-list li {
  font-size: 0.82rem;
  color: #374151;
  padding: 0.35rem 0;
  padding-left: 1.1rem;
  position: relative;
  line-height: 1.5;
}
.arrow-list li::before {
  content: "→";
  position: absolute;
  left: 0;
  color: #9CA3AF;
}

/* ══ COVER ══ */
.cover { flex-direction: row; }
.cover-photo {
  width: 42%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.cover-body {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 3.5rem;
}
.cover-inner { max-width: 32rem; }
.cover-title {
  font-size: 2.6rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.1;
  margin-bottom: 0.85rem;
}
.cover-rule {
  width: 3rem;
  height: 2px;
  background: #E5E7EB;
  margin-bottom: 0.85rem;
}
.cover-subtitle {
  font-size: 0.95rem;
  font-weight: 500;
  color: #374151;
  line-height: 1.55;
  margin-bottom: 0.85rem;
}
.cover-meta {
  font-size: 0.75rem;
  color: #9CA3AF;
  line-height: 1.5;
}

/* ══ IMAGE LEFT / RIGHT ══ */
.il { flex-direction: row; }
.il-photo {
  width: 42%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.il-body {
  flex: 1;
  padding: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ir { flex-direction: row; }
.ir-body {
  flex: 1;
  padding: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ir-photo {
  width: 42%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.inline-rows { margin-top: 0.75rem; }
.inline-row {
  font-size: 0.8rem;
  color: #374151;
  padding: 0.4rem 0;
  border-top: 1px solid #E5E7EB;
  line-height: 1.5;
}

/* ══ TWO COLUMN ══ */
.two-col { flex-direction: column; }
.feat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  flex: 1;
}
.feat-card {
  border-right: 1px solid #E5E7EB;
  border-bottom: 1px solid #E5E7EB;
  padding: 1.75rem 2rem;
  background: #FAFAFA;
  display: flex;
  flex-direction: column;
}
.feat-card:nth-child(even) { border-right: none; }
.feat-card-num {
  font-size: 0.7rem;
  font-weight: 700;
  color: #D1D5DB;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 0.6rem;
}
.feat-title {
  font-size: 1rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.45rem;
}
.feat-desc {
  font-size: 0.84rem;
  color: #4B5563;
  line-height: 1.65;
}

/* ══ ARCHITECTURE ══ */
.arch { flex-direction: row; }
.arch-sidebar {
  width: 28%;
  flex-shrink: 0;
  background: #111111;
  border-right: 3px solid #111111;
  padding: 2.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.arch-sidebar .label { color: #6B7280; }
.arch-sidebar-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.25;
  margin-bottom: 0.75rem;
}
.arch-sidebar-desc {
  font-size: 0.78rem;
  color: #9CA3AF;
  line-height: 1.6;
}
.arch-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
}
.feat-rows { display: flex; flex-direction: column; flex: 1; justify-content: center; gap: 0; }
.feat-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.1rem 0;
  border-bottom: 1px solid #E5E7EB;
}
.feat-row:first-child { border-top: 1px solid #E5E7EB; }
.feat-row-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.feat-row-num {
  font-size: 0.72rem;
  font-weight: 700;
  color: #D1D5DB;
  flex-shrink: 0;
  width: 1.5rem;
  padding-top: 0.1rem;
}
.feat-row-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.25rem;
}
.feat-row-desc {
  font-size: 0.82rem;
  color: #4B5563;
  line-height: 1.6;
}

/* ══ COMPARISON ══ */
.comparison { flex-direction: column; }
.comp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  overflow: hidden;
}
.comp-col {
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2.5rem;
}
.left-panel { border-right: 1px solid #E5E7EB; }
.comp-col-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.65rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #0D0D0D;
}
.comp-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #374151;
  padding: 0.5rem 0;
  border-bottom: 1px solid #E5E7EB;
  line-height: 1.5;
}
.comp-arrow { color: #9CA3AF; flex-shrink: 0; font-size: 0.75rem; }

/* ══ METRICS ══ */
.metrics-slide { flex-direction: row; }
.metrics-slide.reverse { flex-direction: row-reverse; }
.metrics-photo {
  width: 38%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.metrics-body {
  flex: 1;
  padding: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.metrics-list { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.85rem; }
.metric-item { border-bottom: 1px solid #E5E7EB; padding-bottom: 0.75rem; }
.metric-val { font-size: 2.6rem; font-weight: 800; color: #0D0D0D; line-height: 1; }
.metric-lbl { font-size: 0.82rem; font-weight: 700; color: #374151; margin-top: 0.2rem; }
.metric-desc { font-size: 0.76rem; color: #6B7280; margin-top: 0.18rem; line-height: 1.45; }

/* ══ TIMELINE ══ */
.steps { flex-direction: column; }
.steps-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  flex: 1;
}
.step-cell {
  padding: 1.75rem 2.5rem;
  border-bottom: 1px solid #E5E7EB;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
}
.step-cell:nth-child(even) { border-right: none; }
.step-num { font-size: 0.72rem; font-weight: 700; color: #D1D5DB; margin-bottom: 0.4rem; letter-spacing: 0.05em; }
.step-rule { height: 2px; background: #0D0D0D; margin-bottom: 0.6rem; width: 2rem; }
.step-title { font-size: 0.95rem; font-weight: 700; color: #0D0D0D; margin-bottom: 0.35rem; }
.step-desc { font-size: 0.78rem; color: #4B5563; line-height: 1.6; }

/* ══ MINIMAL ══ */
.minimal { flex-direction: row; }
.minimal.reverse { flex-direction: row-reverse; }
.minimal-photo { width: 38%; flex-shrink: 0; background: #1F2937 center/cover; }
.minimal-body { flex: 1; padding: 2.5rem 3rem; display: flex; flex-direction: column; justify-content: center; }
.minimal-body.no-image { align-items: center; text-align: center; padding: 3rem 5rem; }
.minimal-title { font-size: 2.4rem; font-weight: 800; color: #0D0D0D; line-height: 1.15; margin-bottom: 0.85rem; }
.minimal-sub { font-size: 0.95rem; color: #374151; line-height: 1.55; margin-bottom: 0.75rem; }
.highlight-box { margin-top: 1.25rem; background: #F0FDF4; border: 1px solid #86EFAC; padding: 0.85rem 1.1rem; }
.highlight-text { font-size: 0.8rem; color: #15803D; font-weight: 500; line-height: 1.6; }

/* ══ ICON GRID ══ */
.icon-grid-slide { flex-direction: column; }
.icon-grid {
  flex: 1;
  display: grid;
  padding: 0 2rem 1.5rem;
  gap: 1rem;
  align-content: start;
}
.icon-grid.cols-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.icon-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
.icon-card {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
}
.icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  color: #374151;
  flex-shrink: 0;
}
.icon-card-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.35rem;
}
.icon-card-desc {
  font-size: 0.78rem;
  color: #4B5563;
  line-height: 1.6;
}

/* ══ CHALLENGE GRID ══ */
.challenge-slide { flex-direction: column; background: #fff; }

.ch-slide-header {
  padding: 1.6rem 2.5rem 1.1rem;
  border-bottom: 1px solid #E5E7EB;
  flex-shrink: 0;
}
.ch-slide-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.2;
  margin-bottom: 0.2rem;
}
.ch-slide-desc {
  font-size: 0.8rem;
  color: #6B7280;
  line-height: 1.55;
  margin-top: 0.25rem;
}

.challenge-grid {
  flex: 1;
  display: grid;
  padding: 1.1rem 2rem 1.3rem;
  gap: 0.9rem;
  align-content: stretch;
}
.challenge-grid.cols-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; }
.challenge-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }

.challenge-card {
  background: #F8F9FA;
  border: 1px solid #E9ECEF;
  border-top: 3px solid #111111;
  border-radius: 6px;
  padding: 1.1rem 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.ch-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.1rem;
}
.ch-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  flex-shrink: 0;
}
.ch-badge {
  font-size: 0.62rem;
  font-weight: 700;
  color: #9CA3AF;
  letter-spacing: 0.06em;
}

.challenge-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #111111;
  line-height: 1.35;
}
.challenge-desc {
  font-size: 0.76rem;
  color: #4B5563;
  line-height: 1.6;
}

/* ══ FLOW KPI ══ */
.flow-kpi-slide { flex-direction: row; }
.fk-left {
  flex: 1;
  padding: 2.5rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid #E5E7EB;
}
.fk-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.45rem;
}
.fk-subtitle {
  font-size: 0.85rem;
  color: #2563EB;
  font-weight: 500;
  margin-bottom: 0.5rem;
  line-height: 1.5;
}
.fk-desc {
  font-size: 0.82rem;
  color: #4B5563;
  line-height: 1.65;
  margin-bottom: 1.5rem;
}
.fk-flow-band {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 2rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fk-right {
  width: 38%;
  flex-shrink: 0;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.kpi-heading {
  font-size: 0.72rem;
  font-weight: 700;
  color: #9CA3AF;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 1rem;
}
.kpi-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid #E5E7EB;
}
.kpi-val {
  font-size: 2.2rem;
  font-weight: 800;
  color: #111111;
  line-height: 1;
  flex-shrink: 0;
  min-width: 4.5rem;
}
.kpi-lbl {
  font-size: 0.85rem;
  font-weight: 700;
  color: #374151;
}
.kpi-desc {
  font-size: 0.75rem;
  color: #6B7280;
  margin-top: 0.2rem;
  line-height: 1.45;
}

/* ─ Flow nodes (simple row, used for compact flows) ─ */
.flow-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
}
.flow-row.large .flow-circle { width: 80px; height: 80px; }
.flow-row.large .flow-node-label { font-size: 0.85rem; max-width: 9rem; }
.flow-row.large .flow-node-sub { font-size: 0.72rem; }
.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  max-width: 7rem;
  text-align: center;
}
.flow-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 1.5px solid #D1D5DB;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #374151;
  flex-shrink: 0;
}
.flow-node-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #111111;
  text-align: center;
  line-height: 1.3;
}
.flow-node-sub {
  font-size: 0.62rem;
  color: #6B7280;
  text-align: center;
  line-height: 1.3;
}
.flow-arrow {
  color: #9CA3AF;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* ─ Curved arc flow (SVG) ─ */
.curved-arc-flow {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─ Flow KPI large nodes ─ */
.fk-nodes-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
}
.fk-node-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  max-width: 6.5rem;
  text-align: center;
}
.fk-node-circle {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 1.5px solid #D1D5DB;
  background: #F9FAFB;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  flex-shrink: 0;
}
.fk-node-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #111111;
  text-align: center;
  line-height: 1.3;
}
.fk-node-sub {
  font-size: 0.62rem;
  color: #6B7280;
  text-align: center;
}
.fk-chevron {
  color: #D1D5DB;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* ══ NUMBERED STEPS + CALLOUT ══ */
.steps-callout-slide { flex-direction: column; }
.sc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  flex: 1;
}
.sc-cell {
  padding: 1.5rem 2.25rem;
  border-bottom: 1px solid #E5E7EB;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
}
.sc-cell:nth-child(even) { border-right: none; }
.sc-num { font-size: 0.7rem; font-weight: 700; color: #D1D5DB; margin-bottom: 0.4rem; letter-spacing: 0.05em; }
.sc-rule { height: 2px; background: #111111; width: 2rem; margin-bottom: 0.6rem; }
.sc-title { font-size: 0.95rem; font-weight: 700; color: #111111; margin-bottom: 0.35rem; }
.sc-desc { font-size: 0.8rem; color: #4B5563; line-height: 1.6; }
.sc-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 2.25rem;
  background: #F0FDF4;
  border-top: 1px solid #86EFAC;
}
.sc-callout-icon { font-size: 0.9rem; color: #16A34A; flex-shrink: 0; margin-top: 0.05rem; }
.sc-callout-text { font-size: 0.82rem; color: #15803D; font-style: italic; line-height: 1.55; }

/* ══ PROCESS DONUT ══ */
.process-donut-slide { flex-direction: row; }
.pd-left {
  width: 44%;
  flex-shrink: 0;
  background: #111111;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.pd-left .label { color: #6B7280; }
.pd-title { font-size: 1.4rem; font-weight: 800; color: #fff; line-height: 1.25; margin-bottom: 0.5rem; }
.pd-desc { font-size: 0.78rem; color: #9CA3AF; line-height: 1.55; margin-bottom: 1rem; }
.pd-steps { display: flex; flex-direction: column; gap: 0.75rem; }
.pd-step { display: flex; gap: 0.75rem; align-items: flex-start; }
.pd-step-num { font-size: 0.68rem; font-weight: 700; color: #4B5563; flex-shrink: 0; min-width: 1.5rem; padding-top: 0.15rem; }
.pd-step-title { font-size: 0.84rem; font-weight: 700; color: #fff; margin-bottom: 0.15rem; }
.pd-step-desc { font-size: 0.75rem; color: #9CA3AF; line-height: 1.5; }
.pd-right {
  flex: 1;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #fff;
}
.pd-impact-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #9CA3AF;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1.25rem;
}
.pd-donuts {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}
.donut-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.donut-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  text-align: center;
  max-width: 7rem;
  line-height: 1.35;
}

/* ══ STAGGERED PHASES ══ */
.staggered-slide { flex-direction: column; }
.staggered-header { padding: 1.5rem 2.5rem 0.85rem; border-bottom: 1px solid #E5E7EB; }
.staggered-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0.85rem;
  padding: 0.85rem 2.5rem 1.25rem;
}
.phase-box {
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  padding: 1.25rem 1.5rem;
  background: #FAFAFA;
  display: flex;
  flex-direction: column;
}
.phase-left { align-self: stretch; }
.phase-right { align-self: stretch; }
.phase-name { font-size: 0.9rem; font-weight: 700; color: #111111; margin-bottom: 0.2rem; }
.phase-period { font-size: 0.75rem; color: #2563EB; font-weight: 600; margin-bottom: 0.7rem; }
.phase-bullets { list-style: none; display: flex; flex-direction: column; gap: 0.3rem; }
.phase-bullets li {
  font-size: 0.78rem;
  color: #4B5563;
  line-height: 1.55;
  padding-left: 0.85rem;
  position: relative;
}
.phase-bullets li::before { content: "·"; position: absolute; left: 0; color: #9CA3AF; font-size: 1rem; }

/* ══ TECH ECOSYSTEM ══ */
.tech-slide { flex-direction: column; }
.tech-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0;
  padding: 0 2rem;
}
.tech-card {
  border: 1px solid #E5E7EB;
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
}
.tech-icon { color: #374151; margin-bottom: 0.75rem; opacity: 0.85; }
.tech-category {
  font-size: 0.72rem;
  font-weight: 700;
  color: #111111;
  letter-spacing: 0.06em;
  margin-bottom: 0.4rem;
}
.tech-items { font-size: 0.78rem; color: #4B5563; line-height: 1.55; }
.tech-disclaimer {
  padding: 0.65rem 2rem;
  border-top: 1px solid #E5E7EB;
  font-size: 0.72rem;
  color: #6B7280;
}

/* ══ TEXT CHART ══ */
.text-chart-slide {
  flex-direction: row;
  padding: 2.5rem 2.5rem;
  align-items: flex-start;
}
.tc-left {
  flex: 1;
  padding-right: 2.5rem;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
.tc-right {
  width: 42%;
  flex-shrink: 0;
  padding-left: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* arrow list (text chart variant) */
.arrow-list-wrap { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.arrow-item { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.82rem; color: #374151; }
.arrow-icon { color: #9CA3AF; flex-shrink: 0; font-size: 0.9rem; margin-top: 0.05rem; }
.arrow-desc { color: #6B7280; }

/* bar chart */
.bar-chart { width: 100%; }
.bar-chart-inner { display: flex; flex-direction: column; width: 100%; }
.bar-y-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: #9CA3AF;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}
.bar-rows { display: flex; flex-direction: column; gap: 0.7rem; }
.bar-row { display: flex; align-items: center; gap: 0.65rem; }
.bar-lbl { font-size: 0.72rem; color: #374151; min-width: 5.5rem; text-align: right; flex-shrink: 0; font-weight: 500; }
.bar-track {
  flex: 1;
  height: 22px;
  background: #F3F4F6;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.4rem;
  min-width: 2.5rem;
  transition: width 0s;
}
.bar-inner-val {
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.bar-x-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 0.4rem;
  padding-left: calc(5.5rem + 0.65rem);
  font-size: 0.65rem;
  color: #9CA3AF;
}
.bar-x-label {
  font-size: 0.65rem;
  color: #9CA3AF;
  text-align: center;
  margin-top: 0.25rem;
  letter-spacing: 0.04em;
}

/* ══ TEXT FLOW — split (image left) ══ */
.tf-split { flex-direction: row; }
.tf-split-photo {
  width: 40%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.tf-split-body {
  flex: 1;
  padding: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.tf-flow-compact {
  margin-top: 1.5rem;
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 1.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ══ TEXT FLOW — full-width (no image) ══ */
.text-flow-slide {
  flex-direction: column;
  padding: 2.5rem 3rem 1.5rem;
}
.tf-top {
  display: flex;
  gap: 3rem;
  margin-bottom: 1.5rem;
  align-items: flex-start;
}
.tf-top-left { flex: 1; }
.tf-top-right {
  flex: 1;
  display: flex;
  align-items: center;
}
.tf-desc {
  font-size: 0.85rem;
  color: #4B5563;
  line-height: 1.7;
}
.tf-flow-band {
  flex: 1;
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
.tf-foot {
  font-size: 0.82rem;
  color: #2563EB;
  line-height: 1.65;
  margin-top: 1.25rem;
  font-style: italic;
}

/* ══ QUOTE IMAGE ══ */
.quote-image-slide { flex-direction: row; }
.qi-photo {
  width: 42%;
  flex-shrink: 0;
  background: #1F2937 center/cover;
}
.qi-body {
  flex: 1;
  padding: 3rem 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.qi-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.2;
  margin-bottom: 1rem;
}
.qi-quote {
  border-left: 3px solid #111111;
  padding-left: 1rem;
  font-size: 0.88rem;
  font-style: italic;
  color: #374151;
  line-height: 1.65;
  margin-bottom: 1rem;
}
.qi-bullets { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; }
.qi-bullet { font-size: 0.8rem; color: #4B5563; }
.qi-tags { display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; }
.qi-tag {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: #F3F4F6;
  color: #374151;
  padding: 0.3rem 0.7rem;
  border: 1px solid #E5E7EB;
}
`;

// ─── HTML GENERATOR ────────────────────────────────────────────────────────────
function buildHTML(deckTitle: string, slides: Slide[]): string {
  const sorted = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);
  const slideHTMLs = sorted.map(s => RENDERERS[resolveLayout(s)](s));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(deckTitle)}</title>
<style>${STYLES}</style>
</head>
<body>
${slideHTMLs.join("\n")}
</body>
</html>`;
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────────
export async function generatePDF(
  deckTitle: string,
  slides: Slide[],
  storyTheme = ""
): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const html = buildHTML(deckTitle, slides);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const fileName = `${Date.now()}.pdf`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    await page.pdf({
      path: filePath,
      width: "13.33in",
      height: "7.5in",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return filePath;
  } finally {
    await browser.close();
  }
}

// ─── PHOTO LAYOUT CHECK (used by index.ts to skip image fetch for non-photo layouts) ─
export function needsPhoto(slide: Slide): boolean {
  return PHOTO_LAYOUTS.has(resolveLayout(slide));
}
