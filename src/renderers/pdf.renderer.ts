import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import type { Slide, LayoutType, FlowNode, ChartBar, Phase } from "./slide.types";

const OUTPUT_DIR = path.resolve(process.cwd(), "generated");

// ─── LAYOUTS WITH PHOTOS ───────────────────────────────────────────────────────
// Only cover (hero) and closing (quote_image) fetch Unsplash photos.
// image_left / image_right are used when AI explicitly picks them for case studies.
// text_flow, text_chart, and all diagram layouts never fetch photos.
const PHOTO_LAYOUTS = new Set(["hero", "image_left", "image_right", "quote_image", "challenge_grid"]);

const VALID_LAYOUTS = new Set<string>([
  "hero", "image_right", "image_left", "two_column",
  "metrics", "timeline", "architecture", "comparison", "minimal",
  "icon_grid", "challenge_grid", "flow_kpi", "numbered_steps_callout",
  "process_donut", "staggered_phases", "tech_ecosystem",
  "text_chart", "text_flow", "quote_image",
  "dark_steps", "dark_comparison", "dark_flow",
  "concentric_layers", "big_numbers", "split_insight",
  "funnel_stages", "arrow_pipeline", "pyramid_tiers", "circular_flow", "venn_overlap",
  "petal_diagram",
]);

const SLIDE_TYPE_FALLBACK: Record<string, LayoutType> = {
  cover:                    "hero",
  market_opportunity:       "text_flow",
  client_challenges:        "challenge_grid",
  solution_overview:        "dark_flow",
  product_capabilities:     "icon_grid",
  technical_architecture:   "concentric_layers",
  business_impact:          "process_donut",
  implementation_timeline:  "staggered_phases",
  pricing:                  "minimal",
  call_to_action:           "quote_image",
  // AI variants
  executive:                "text_chart",
  executive_summary:        "text_chart",
  executive_slide:          "text_chart",
  hidden_costs:             "challenge_grid",
  use_cases:                "dark_steps",
  integration:              "tech_ecosystem",
  roi:                      "flow_kpi",
  competitive_advantage:    "split_insight",
  roi:                      "big_numbers",
  case_study:               "image_left",
  closing:                  "quote_image",
  chapter_intro:            "minimal",
  funnel:                   "funnel_stages",
  pipeline:                 "arrow_pipeline",
  pyramid:                  "pyramid_tiers",
  segmentation:             "pyramid_tiers",
  circular:                 "circular_flow",
  venn:                     "venn_overlap",
  ecosystem:                "venn_overlap",
  capabilities:             "petal_diagram",
  flower:                   "petal_diagram",
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

// Black & white professional palette — premium monochrome enterprise look
const ACCENT_PALETTE = [
  "#111111", // near-black
  "#1E293B", // dark charcoal-navy
  "#111111",
  "#1E293B",
  "#111111",
  "#1E293B",
];
const CHALLENGE_PALETTE = [
  "#1E293B", // dark charcoal-navy
  "#111111",
  "#1E293B",
  "#111111",
  "#1E293B",
  "#111111",
];

function icon(name: string, size = 20): string {
  const paths = ICONS[name] ?? ICONS["star"];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// ─── SVG CHART HELPERS ─────────────────────────────────────────────────────────

// Split a label into at most 2 lines — never cuts mid-word
function svgLines(text: string, maxChars = 14): [string, string?] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  let line1 = "";
  let line2 = "";
  let filling = 1;
  for (const w of words) {
    if (filling === 1) {
      const candidate = (line1 + " " + w).trim();
      if (candidate.length <= maxChars) {
        line1 = candidate;
      } else {
        filling = 2;
        line2 = w;
      }
    } else {
      const candidate = (line2 + " " + w).trim();
      // Allow line2 up to maxChars; stop adding words once full
      if (candidate.length <= maxChars) {
        line2 = candidate;
      }
    }
  }
  return line2 ? [line1, line2] : [line1];
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
  const W = 1000, H = 180;
  const r = 36;
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
      fill="none" stroke="#93C5FD" stroke-width="2" stroke-dasharray="6 3"/>`;
  }

  const circles = Array.from({ length: n }, (_, i) => {
    const x = spacing * (i + 1);
    const icoName = nodes[i]?.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    const icoPaths = ICONS[icoName] ?? ICONS["check-circle"] ?? "";
    const labelLines = svgLines(nodes[i]?.label ?? "", 17);
    const subLines = nodes[i]?.sublabel ? svgLines(nodes[i]!.sublabel!, 15) : [];
    const labelY1 = r * 2 + 24;
    const labelY2 = labelY1 + 15;
    const subY = (labelLines.length > 1 ? labelY2 : labelY1) + 14;
    const fillColor = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#1E3A5F";
    return `<g transform="translate(${x - r},${cy - r})">
      <circle cx="${r}" cy="${r}" r="${r}" fill="${fillColor}" stroke="${fillColor}" stroke-width="1.5"/>
      <svg x="${r - 13}" y="${r - 13}" width="26" height="26" viewBox="0 0 24 24"
        fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icoPaths}
      </svg>
      <text x="${r}" y="${labelY1}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[0])}</text>
      ${labelLines[1] ? `<text x="${r}" y="${labelY2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[1])}</text>` : ""}
      ${subLines[0] ? `<text x="${r}" y="${subY}" text-anchor="middle" font-size="9" fill="#6B7280" font-family="Inter,sans-serif">${esc(subLines[0])}</text>` : ""}
    </g>`;
  }).join("");

  const totalH = H + 85;
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

// ── COMPARISON (dark table) ────────────────────────────────────────────────────
function renderComparison(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 9);
  const parts = slide.subtitle?.includes("|")
    ? slide.subtitle.split("|").map(s => s.trim())
    : ["Without Solution", "With Our Solution"];
  const [leftTitle, rightTitle] = parts;

  // Detect table format: "Feature: left | right"
  const isTable = bullets.some(b => b.includes(" | "));

  if (isTable) {
    const rows = bullets.map(b => {
      const colonIdx = b.indexOf(": ");
      if (colonIdx > 0) {
        const feature = b.slice(0, colonIdx).trim();
        const rest = b.slice(colonIdx + 2);
        const pipeIdx = rest.indexOf(" | ");
        return pipeIdx > 0
          ? { feature, left: rest.slice(0, pipeIdx).trim(), right: rest.slice(pipeIdx + 3).trim() }
          : { feature, left: rest.trim(), right: "" };
      }
      const pipeIdx = b.indexOf(" | ");
      return pipeIdx > 0
        ? { feature: b.slice(0, pipeIdx).trim(), left: "", right: b.slice(pipeIdx + 3).trim() }
        : { feature: b, left: "", right: "" };
    });

    return `<div class="slide dark-comp-slide">
  ${label(slide.headerTag) ? `<p class="dark-label">${esc(slide.headerTag ?? "")}</p>` : ""}
  <h2 class="dark-comp-title">${esc(slide.title ?? "")}</h2>
  ${slide.description ? `<p class="dark-comp-desc">${esc(slide.description)}</p>` : ""}
  <div class="dark-comp-table-wrap">
    <table class="dark-comp-table">
      <thead>
        <tr>
          <th class="dct-th-feat">Capability</th>
          <th class="dct-th-bad">${esc(leftTitle ?? "Without")}</th>
          <th class="dct-th-good">${esc(rightTitle ?? "With Solution")}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `<tr class="dct-tr">
          <td class="dct-td-feat">${esc(r.feature)}</td>
          <td class="dct-td-bad">${esc(r.left)}</td>
          <td class="dct-td-good">${esc(r.right)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
  ${slide.description?.includes("Note:") || bullets.length === 0 ? "" : ""}
</div>`;
  }

  // Fallback: two-column layout (dark themed)
  const half = Math.ceil(bullets.length / 2);
  const leftBullets = bullets.slice(0, half);
  const rightBullets = bullets.slice(half);
  return `<div class="slide dark-comp-slide">
  ${label(slide.headerTag) ? `<p class="dark-label">${esc(slide.headerTag ?? "")}</p>` : ""}
  <h2 class="dark-comp-title">${esc(slide.title ?? "")}</h2>
  ${slide.description ? `<p class="dark-comp-desc">${esc(slide.description)}</p>` : ""}
  <div class="dark-comp-cols">
    <div class="dark-comp-col dark-comp-col-left">
      <p class="dark-comp-col-hdr">${esc(leftTitle ?? "")}</p>
      ${leftBullets.map(b => {
        const p = parseBullet(b);
        return `<div class="dark-comp-row"><span class="dco-x">✗</span><div>${p.title ? `<strong>${esc(p.title)}</strong> — ` : ""}${esc(p.desc)}</div></div>`;
      }).join("")}
    </div>
    <div class="dark-comp-col dark-comp-col-right">
      <p class="dark-comp-col-hdr">${esc(rightTitle ?? "")}</p>
      ${rightBullets.map(b => {
        const p = parseBullet(b);
        return `<div class="dark-comp-row"><span class="dco-check">✓</span><div>${p.title ? `<strong>${esc(p.title)}</strong> — ` : ""}${esc(p.desc)}</div></div>`;
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
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 6);
  const cols = bullets.length <= 4 ? 2 : 3;
  return `<div class="slide icon-grid-slide">
  <div class="white-header ig-header">
    <div class="ig-header-left">
      ${label(slide.headerTag)}
      <h2 class="page-title">${esc(slide.title ?? "")}</h2>
      ${slide.subtitle ? `<p class="body-text colored">${esc(slide.subtitle)}</p>` : ""}
    </div>
    ${slide.description ? `<div class="ig-header-right"><p class="ig-desc">${esc(slide.description)}</p></div>` : ""}
  </div>
  <div class="icon-grid cols-${cols}">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      const ico = ICON_POOL[i % ICON_POOL.length] ?? "star";
      const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#1E3A5F";
      return `<div class="icon-card">
        <div class="ic-band" style="background:${accent}">
          <div class="ic-icon-in-band">${icon(ico, 26)}</div>
          <span class="ic-num-badge">0${i + 1}</span>
        </div>
        <div class="ic-card-body">
          ${p.title ? `<p class="icon-card-title">${esc(p.title)}</p>` : ""}
          <p class="icon-card-desc">${esc(p.desc)}</p>
        </div>
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
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  const CG_ACCENT = "#4F46E5";
  const CG_CARD_BG = "#EEF2FF";

  return `<div class="slide cg-slide">
  <div class="cg-left">
    <div class="cg-header">
      ${label(slide.headerTag)}
      <h2 class="cg-title">${esc(slide.title ?? "")}</h2>
      ${slide.description ? `<p class="cg-desc">${esc(slide.description)}</p>` : ""}
    </div>
    <div class="cg-cards">
      ${bullets.map((b, i) => {
        const p = parseBullet(b);
        const icoName = CHALLENGE_ICONS[i % CHALLENGE_ICONS.length] ?? "alert-triangle";
        return `<div class="cg-card" style="background:${CG_CARD_BG}">
          <div class="cg-icon-circle" style="background:${CG_ACCENT}">${icon(icoName, 20)}</div>
          <div class="cg-card-text">
            ${p.title ? `<p class="cg-card-title">${esc(p.title)}</p>` : ""}
            <p class="cg-card-desc">${esc(p.title ? p.desc : p.desc)}</p>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  ${slide.imageUrl ? `<div class="cg-img-panel">
    <img class="cg-img" src="${slide.imageUrl}" alt="">
  </div>` : ""}
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
    const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#1E3A5F";
    return `<div class="fk-node-wrap">
      <div class="fk-node-circle" style="background:${accent};border-color:${accent};color:#fff">${icon(icoName, 36)}</div>
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

// ── NUMBERED STEPS + CALLOUT (dark numbered grid) ─────────────────────────────
function extractFallbackSteps(slide: Slide): string[] {
  const desc = slide.description ?? "";
  // Try comma/semicolon splitting first (often has "A, B, C, and D" lists)
  const commaSplit = desc.split(/[,;]/).map(s => s.trim().replace(/^(and|or)\s+/i, "")).filter(s => s.length > 8);
  if (commaSplit.length >= 3) return commaSplit.slice(0, 4);
  // Fall back to sentence splitting
  const sentences = desc.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
  if (sentences.length >= 2) return sentences.slice(0, 4);
  // Last resort: use subtitle split or the whole description as one item
  const sub = slide.subtitle ?? "";
  if (sub.length > 15) return [sub];
  return [];
}

function renderNumberedStepsCallout(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 4);
  const calloutText = slide.subtitle ?? "";
  return `<div class="slide dark-steps-slide">
  <div class="ds-header">
    <h2 class="ds-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="ds-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="ds-grid">
    ${bullets.map((b, i) => {
      const p = parseBullet(b);
      return `<div class="ds-cell">
        <div class="ds-num-ring"><span class="ds-num">${i + 1}</span></div>
        <div class="ds-cell-body">
          ${p.title ? `<p class="ds-cell-title">${esc(p.title)}</p>` : ""}
          <p class="ds-cell-desc">${esc(p.desc)}</p>
        </div>
      </div>`;
    }).join("")}
  </div>
  ${calloutText ? `<div class="ds-callout">
    <span class="ds-callout-icon">☐</span>
    <p class="ds-callout-text">${esc(calloutText)}</p>
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
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 6);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 6);
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
function renderMetricKpiStack(metrics: { label: string; value: string }[]): string {
  return `<div class="tc-kpi-stack">
    ${metrics.slice(0, 4).map((m, i) => {
      const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#1E3A5F";
      return `<div class="tc-kpi-row">
        <p class="tc-kpi-val" style="color:${accent}">${esc(m.value)}</p>
        <p class="tc-kpi-lbl">${esc(cap(m.label))}</p>
      </div>`;
    }).join("")}
  </div>`;
}

function renderTextChart(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  const bars: ChartBar[] = (slide.chartBars ?? []).filter(Boolean).slice(0, 6);
  const fallbackBars = (slide.metrics ?? []).map(m => ({
    label: m.label,
    value: parsePercent(m.value),
  })).filter(b => b.value > 0);
  const chartData = bars.length > 0 ? bars : fallbackBars;
  const metrics = (slide.metrics ?? []).filter(Boolean).slice(0, 4);

  // Right panel: prefer bar chart, then kpi stack from metrics, then prominent description
  let rightPanel = "";
  if (chartData.length >= 2) {
    rightPanel = renderBarChart(chartData);
  } else if (metrics.length >= 2) {
    rightPanel = renderMetricKpiStack(metrics);
  } else {
    // If we only have bullets, render them as numbered callouts on the right
    const rightBullets = bullets.slice(0, 4);
    rightPanel = rightBullets.length > 0
      ? `<div class="tc-callout-stack">
          ${rightBullets.map((b, i) => {
            const p = parseBullet(b);
            const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#1E3A5F";
            return `<div class="tc-callout-item" style="border-left:3px solid ${accent}">
              ${p.title ? `<p class="tc-callout-title">${esc(p.title)}</p>` : ""}
              <p class="tc-callout-desc">${esc(p.desc)}</p>
            </div>`;
          }).join("")}
        </div>`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#D1D5DB;font-size:0.9rem">No data</div>`;
  }

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
    ${rightPanel}
  </div>
</div>`;
}

// ── TEXT + FLOW ────────────────────────────────────────────────────────────────
function renderTextFlow(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 5);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  let flowData: FlowNode[] = nodes.length > 0
    ? nodes
    : bullets.slice(0, 4).map(b => { const p = parseBullet(b); return { label: p.title || p.desc, sublabel: p.desc && p.title ? p.desc.split(" ").slice(0, 3).join(" ") : "" }; });

  // Fallback: derive flow nodes from description sentences when no data
  if (flowData.length === 0 && slide.description) {
    const sentences = slide.description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 4);
    flowData = sentences.map((s, i) => ({
      label: s.split(" ").slice(0, 3).join(" "),
      sublabel: s.split(" ").slice(3, 7).join(" "),
      icon: ICON_POOL[i % ICON_POOL.length] ?? "check-circle",
    }));
  }

  // When sparse (< 2 nodes), use a prominent bullet list fallback instead of an isolated circle
  const flowBandContent = flowData.length >= 2
    ? renderCurvedArcFlow(flowData)
    : `<div class="tf-list-fallback">
        ${bullets.slice(0, 6).map((b, i) => {
          const p = parseBullet(b);
          const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#1E3A5F";
          return `<div class="tf-list-item">
            <span class="tf-list-num" style="background:${accent}">${String(i + 1).padStart(2, "0")}</span>
            <div>
              ${p.title ? `<strong class="tf-list-title">${esc(p.title)}</strong>` : ""}
              ${p.desc ? `<p class="tf-list-desc">${esc(p.desc)}</p>` : ""}
            </div>
          </div>`;
        }).join("") || `<p class="tf-desc" style="color:#6B7280;font-style:italic">${esc(slide.description ?? slide.subtitle ?? "")}</p>`}
      </div>`;

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
    ${flowBandContent}
  </div>
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

// ── CONCENTRIC LAYERS ─────────────────────────────────────────────────────────
function renderConcentricLayers(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 3);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);

  const fallbackLabels = ["Channel Layer", "Platform Layer", "Intelligence Core"];
  const layers: FlowNode[] = fallbackLabels.map((fl, i) => nodes[i] ?? { label: fl, sublabel: "" });

  // Left-biased layout: circles on left half, labels on right
  const CX = 310, CY = 155;
  const radii =  [140, 100, 58];
  // outer = lightest, inner = darkest
  const ringFills   = ["#F3F4F6", "#D1D5DB", "#111111"];
  const ringStrokes = ["#D1D5DB", "#6B7280", "#111111"];

  // Build rings outer→inner (draw largest first)
  const rings = [0, 1, 2].map(i =>
    `<circle cx="${CX}" cy="${CY}" r="${radii[i]}" fill="${ringFills[i]}" stroke="${ringStrokes[i]}" stroke-width="${i === 0 ? 1.5 : 2}"/>`
  ).join("\n      ");

  // Inner ring label (white text centered)
  const innerLabel = layers[2]?.label ?? "";
  const innerCenter = `<text x="${CX}" y="${CY + 5}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff" font-family="Inter,sans-serif">${esc(innerLabel)}</text>`;

  // Callout positions: dots on ring edge, labels on right side
  // All dots on right side of their ring (0° = right, slightly offset vertically)
  const dotAngles = [-35, 0, 38]; // degrees
  const rightX = 530; // label area starts here

  const labelYs = [CY - 90, CY, CY + 95];

  const callouts = layers.slice(0, 3).map((layer, i) => {
    const r = radii[i] ?? radii[radii.length - 1]!;
    const angle = dotAngles[i] ?? 0;
    const ly = labelYs[i] ?? CY;
    const rad = (angle * Math.PI) / 180;
    const dotX = parseFloat((CX + r * Math.cos(rad)).toFixed(1));
    const dotY = parseFloat((CY + r * Math.sin(rad)).toFixed(1));
    const dotColor = i === 2 ? "#ffffff" : (ringStrokes[i] ?? "#3B82F6");
    const strokeColor = ringStrokes[i] ?? "#3B82F6";
    const fillColor = ringFills[i] ?? "#EFF6FF";
    const subLines = layer.sublabel ? svgLines(layer.sublabel, 22) : [];
    return `
      <line x1="${dotX}" y1="${dotY}" x2="${rightX - 8}" y2="${ly}" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="4 3"/>
      <circle cx="${dotX}" cy="${dotY}" r="5" fill="${dotColor}" stroke="${strokeColor}" stroke-width="2"/>
      <rect x="${rightX}" y="${ly - 22}" width="360" height="${subLines.length > 0 ? 44 : 26}" rx="5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.2"/>
      <text x="${rightX + 12}" y="${ly - 5}" text-anchor="start" font-size="13" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(layer.label ?? "")}</text>
      ${subLines[0] ? `<text x="${rightX + 12}" y="${ly + 12}" text-anchor="start" font-size="10.5" fill="#4B5563" font-family="Inter,sans-serif">${esc(subLines[0])}</text>` : ""}
      ${subLines[1] ? `<text x="${rightX + 12}" y="${ly + 24}" text-anchor="start" font-size="10.5" fill="#4B5563" font-family="Inter,sans-serif">${esc(subLines[1])}</text>` : ""}`;
  }).join("");

  // Cards: guard against "Feature Name" literal placeholder
  const cardItems = bullets.map(b => {
    const p = parseBullet(b);
    const isPlaceholder = /^feature name$/i.test((p.title || "").trim());
    const title = isPlaceholder ? "" : p.title;
    const desc  = p.desc;
    return { title, desc };
  });

  return `<div class="slide conc-slide">
  <div class="conc-header">
    ${label(slide.headerTag)}
    <h2 class="conc-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="conc-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="conc-diagram-wrap">
    <svg viewBox="0 0 960 310" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      ${rings}
      ${innerCenter}
      ${callouts}
    </svg>
  </div>
  <div class="conc-card-grid">
    ${cardItems.map(({ title, desc }) => `<div class="conc-card">
        ${title ? `<p class="conc-card-title">${esc(title)}</p>` : ""}
        <p class="conc-card-desc${title ? "" : " conc-card-desc--solo"}">${esc(desc)}</p>
      </div>`).join("")}
  </div>
</div>`;
}

// ── BIG NUMBERS ────────────────────────────────────────────────────────────────
function renderBigNumbers(slide: Slide): string {
  const stats = (slide.metrics ?? []).filter(m => m.value && m.label).slice(0, 3);
  const fallback = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 3).map(b => {
    const p = parseBullet(b);
    return { label: p.title || "", value: p.desc };
  });
  const items = stats.length >= 2 ? stats : fallback;

  return `<div class="slide bn-slide">
  <div class="bn-header">
    ${label(slide.headerTag)}
    <h2 class="bn-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="bn-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="bn-stats cols-${items.length}">
    ${items.map((m, i) => {
      const accent = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#111111";
      return `<div class="bn-stat">
        <div class="bn-value" style="color:${accent}">${esc(m.value)}</div>
        <div class="bn-label">${esc(m.label)}</div>
      </div>`;
    }).join('<div class="bn-divider"></div>')}
  </div>
  ${slide.subtitle ? `<p class="bn-foot">${esc(slide.subtitle)}</p>` : ""}
</div>`;
}

// ── SPLIT INSIGHT ───────────────────────────────────────────────────────────────
// Titles that the AI sometimes uses literally — strip them and show only the description
const SI_JUNK_TITLES = new Set(["left", "right", "challenge", "solution", "problem", "benefit", "issue", "point"]);

function renderSplitInsight(slide: Slide): string {
  const allBullets = (slide.bulletPoints ?? []).filter(Boolean);
  const half = Math.ceil(allBullets.length / 2);
  const leftBullets  = allBullets.slice(0, half);
  const rightBullets = allBullets.slice(half);

  // If subtitle contains " | ", split into left/right headers
  const [leftHead, rightHead] = (slide.subtitle ?? "").includes(" | ")
    ? (slide.subtitle ?? "").split(" | ")
    : ["The Challenge", "The Solution"];

  const renderItem = (b: string, dotClass: string) => {
    const p = parseBullet(b);
    // If the AI used a generic/junk title, treat the whole thing as description only
    const titleIsJunk = !p.title || SI_JUNK_TITLES.has(p.title.toLowerCase().trim());
    const showTitle  = !titleIsJunk && p.title;
    const showDesc   = titleIsJunk ? (p.title ? `${p.title}: ${p.desc}`.replace(/^:\s*/, "").trim() : p.desc) : p.desc;
    return `<li class="si-item">
      <span class="si-bullet-dot ${dotClass}"></span>
      <span>${showTitle ? `<strong class="si-item-title">${esc(showTitle)}</strong><br>` : ""}<span class="si-item-desc">${esc(showDesc)}</span></span>
    </li>`;
  };

  return `<div class="slide si-slide">
  <div class="si-top">
    ${label(slide.headerTag)}
    <h2 class="si-title">${esc(slide.title ?? "")}</h2>
  </div>
  <div class="si-body">
    <div class="si-left">
      <p class="si-panel-head si-left-head">${esc(leftHead.trim())}</p>
      <ul class="si-list">
        ${leftBullets.map(b => renderItem(b, "si-dot-left")).join("")}
      </ul>
    </div>
    <div class="si-divider"></div>
    <div class="si-right">
      <p class="si-panel-head si-right-head">${esc(rightHead.trim())}</p>
      <ul class="si-list">
        ${rightBullets.map(b => renderItem(b, "si-dot-right")).join("")}
      </ul>
    </div>
  </div>
</div>`;
}

// ── DARK COMPARISON (alias — same renderer, already handles dark) ───────────────
const renderDarkComparison = renderComparison;

// ── DARK STEPS (alias — same renderer, already redesigned to dark) ──────────────
const renderDarkSteps = renderNumberedStepsCallout;

// ── DARK FLOW ──────────────────────────────────────────────────────────────────
function renderDarkFlow(slide: Slide): string {
  const nodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 5);
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  let flowData: FlowNode[] = nodes.length > 0
    ? nodes
    : bullets.slice(0, 5).map(b => { const p = parseBullet(b); return { label: p.title || p.desc, sublabel: p.desc && p.title ? p.desc.split(" ").slice(0, 3).join(" ") : "", icon: ICON_POOL[bullets.indexOf(b) % ICON_POOL.length] }; });

  if (flowData.length === 0 && slide.description) {
    const sentences = slide.description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 5);
    flowData = sentences.map((s, i) => ({
      label: s.split(" ").slice(0, 3).join(" "),
      sublabel: s.split(" ").slice(3, 6).join(" "),
      icon: ICON_POOL[i % ICON_POOL.length] ?? "check-circle",
    }));
  }

  // Build dark-themed curved arc flow (white icons, white connector lines)
  const n = Math.min(flowData.length, 5);
  const W = 1000, H = 190, r = 42;
  const spacing = W / (n + 1);
  const cy = H / 2;

  let paths = "";
  for (let i = 0; i < n - 1; i++) {
    const x1 = spacing * (i + 1) + r;
    const x2 = spacing * (i + 2) - r;
    const midX = (x1 + x2) / 2;
    const arcH = 42;
    const dir = i % 2 === 0 ? -1 : 1;
    paths += `<path d="M ${x1} ${cy} Q ${midX} ${cy + dir * arcH} ${x2} ${cy}"
      fill="none" stroke="#4B5563" stroke-width="2.5" stroke-dasharray="8 4"/>`;
  }

  const circles = Array.from({ length: n }, (_, i) => {
    const x = spacing * (i + 1);
    const icoName = flowData[i]?.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    const icoPaths = ICONS[icoName] ?? ICONS["check-circle"] ?? "";
    const labelLines = svgLines(flowData[i]?.label ?? "", 17);
    const subLines = flowData[i]?.sublabel ? svgLines(flowData[i]!.sublabel!, 15) : [];
    const labelY1 = r * 2 + 26;
    const labelY2 = labelY1 + 16;
    const subY = (labelLines.length > 1 ? labelY2 : labelY1) + 16;
    const fillColor = ACCENT_PALETTE[i % ACCENT_PALETTE.length] ?? "#1E3A5F";
    return `<g transform="translate(${x - r},${cy - r})">
      <circle cx="${r}" cy="${r}" r="${r}" fill="${fillColor}" stroke="${fillColor}" stroke-width="1.5"/>
      <svg x="${r - 15}" y="${r - 15}" width="30" height="30" viewBox="0 0 24 24"
        fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icoPaths}
      </svg>
      <text x="${r}" y="${labelY1}" text-anchor="middle" font-size="11" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[0])}</text>
      ${labelLines[1] ? `<text x="${r}" y="${labelY2}" text-anchor="middle" font-size="11" font-weight="700" fill="#111111" font-family="Inter,sans-serif">${esc(labelLines[1])}</text>` : ""}
      ${subLines[0] ? `<text x="${r}" y="${subY}" text-anchor="middle" font-size="9.5" fill="#6B7280" font-family="Inter,sans-serif">${esc(subLines[0])}</text>` : ""}
    </g>`;
  }).join("");

  const totalH = H + 90;

  return `<div class="slide dark-flow-slide">
  <div class="df-header">
    ${slide.headerTag ? `<p class="dark-label">${esc(slide.headerTag)}</p>` : ""}
    <h2 class="df-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="df-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="df-flow-band">
    <svg viewBox="0 0 ${W} ${totalH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      ${paths}
      ${circles}
    </svg>
  </div>
  ${slide.subtitle ? `<p class="df-foot">${esc(slide.subtitle)}</p>` : ""}
</div>`;
}

// ── FUNNEL STAGES ──────────────────────────────────────────────────────────────
function renderFunnelStages(slide: Slide): string {
  const bullets = (slide.bulletPoints ?? []).filter(Boolean);
  const metrics = (slide.metrics ?? []).filter(Boolean);
  type FItem = { name: string; value: string; desc: string };
  let items: FItem[] = metrics.length >= 2
    ? metrics.slice(0, 4).map(m => ({ name: m.label, value: m.value, desc: "" }))
    : bullets.slice(0, 4).map(b => {
        const p = parseBullet(b);
        return { name: p.title || p.desc, value: p.title ? p.desc : "", desc: "" };
      });
  if (items.length === 0 && slide.description) items = extractFallbackSteps(slide).slice(0, 4).map(s => ({ name: s, value: "", desc: "" }));
  const n = Math.min(items.length, 4);
  if (n === 0) return renderMinimal(slide);

  const W = 460, H_BAND = 82, GAP = 5;
  const cx = W / 2;
  const shrink = Math.floor((W - 120) / n);
  const FCOLORS = ['#1E293B', '#374151', '#4B5563', '#6B7280'];

  const bands = items.slice(0, n).map((item, i) => {
    const topW = W - i * shrink;
    const botW = Math.max(topW - shrink, 80);
    const topY = i * (H_BAND + GAP);
    const botY = topY + H_BAND;
    const midY = (topY + botY) / 2;
    const col = FCOLORS[i] ?? '#6B7280';
    return `<polygon points="${cx-topW/2},${topY} ${cx+topW/2},${topY} ${cx+botW/2},${botY} ${cx-botW/2},${botY}" fill="${col}"/>
      <text x="${cx}" y="${midY - 7}" text-anchor="middle" font-size="13" font-weight="700" fill="white" font-family="system-ui,sans-serif">${esc(item.name)}</text>
      ${item.value ? `<text x="${cx}" y="${midY + 13}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.75)" font-family="system-ui,sans-serif">${esc(item.value)}</text>` : ""}`;
  });

  return `<div class="slide fn-slide">
  <div class="fn-left">
    ${label(slide.headerTag)}
    <h2 class="fn-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="fn-desc">${esc(slide.description)}</p>` : ""}
    <div class="fn-legend">
      ${items.slice(0, n).map((item, i) => `<div class="fn-leg-row">
        <span class="fn-dot" style="background:${FCOLORS[i] ?? '#6B7280'}"></span>
        <div class="fn-leg-text">
          <span class="fn-leg-name">${esc(item.name)}</span>
          ${item.value ? `<span class="fn-leg-val">${esc(item.value)}</span>` : ""}
        </div>
      </div>`).join("")}
    </div>
    ${slide.subtitle ? `<p class="fn-foot">${esc(slide.subtitle)}</p>` : ""}
  </div>
  <div class="fn-right">
    <svg viewBox="0 0 ${W} ${n*(H_BAND+GAP)}" xmlns="http://www.w3.org/2000/svg" class="fn-svg">
      ${bands.join("\n      ")}
    </svg>
  </div>
</div>`;
}

// ── ARROW PIPELINE ─────────────────────────────────────────────────────────────
function renderArrowPipeline(slide: Slide): string {
  let steps = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (steps.length === 0) steps = (slide.flowNodes ?? []).map(n => `${n.label}${n.sublabel ? `: ${n.sublabel}` : ""}`).slice(0, 5);
  if (steps.length === 0) steps = extractFallbackSteps(slide).slice(0, 5);
  const n = Math.min(steps.length, 5);
  if (n === 0) return renderMinimal(slide);

  const AP_COLORS = ['#111111', '#1E293B', '#374151', '#4B5563', '#6B7280'];

  return `<div class="slide ap-slide">
  <div class="ap-header">
    ${label(slide.headerTag)}
    <h2 class="ap-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="ap-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="ap-arrows ap-n${n}">
    ${steps.slice(0, n).map((b, i) => {
      const p = parseBullet(b);
      const col = AP_COLORS[i % AP_COLORS.length] ?? '#374151';
      const isFirst = i === 0;
      return `<div class="ap-arrow${isFirst ? " ap-first" : ""}" style="background:${col}">
        <span class="ap-num">0${i + 1}</span>
        <p class="ap-step-title">${esc(p.title || p.desc)}</p>
        ${p.title && p.desc ? `<p class="ap-step-desc">${esc(p.desc)}</p>` : ""}
      </div>`;
    }).join("")}
  </div>
  ${slide.subtitle ? `<div class="ap-callout">${esc(slide.subtitle)}</div>` : ""}
</div>`;
}

// ── PYRAMID TIERS ──────────────────────────────────────────────────────────────
function renderPyramidTiers(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 5);
  // items[0] = bottom tier (widest, mass), items[N-1] = top tier (narrowest, premium)
  const items = bullets.map(b => parseBullet(b));
  const N = Math.max(3, Math.min(items.length, 5));

  const COLOR_SETS: Record<number, string[]> = {
    3: ['#553C9A', '#C27803', '#C53030'],
    4: ['#553C9A', '#276749', '#C27803', '#C53030'],
    5: ['#553C9A', '#2C7A7B', '#276749', '#C27803', '#C53030'],
  };
  const colors = COLOR_SETS[N] ?? COLOR_SETS[5]!;

  const VW = 700, VH = 460;
  const APEX_X = VW / 2, APEX_Y = 12;
  const BASE_Y = VH - 10;
  const TOTAL_H = BASE_Y - APEX_Y;
  const MAX_HALF_W = VW / 2 - 8;
  const bandH = TOTAL_H / N;

  const hw = (y: number) => ((y - APEX_Y) / TOTAL_H) * MAX_HALF_W;
  const lx = (y: number) => APEX_X - hw(y);
  const rx = (y: number) => APEX_X + hw(y);

  // Full pyramid outline for clip-path — clips text to stay inside triangle
  const clipId = "py-clip";
  const outlinePoints = `${APEX_X},${APEX_Y} ${rx(BASE_Y)},${BASE_Y} ${lx(BASE_Y)},${BASE_Y}`;

  const tiersSVG = Array.from({ length: N }, (_, i) => {
    const y1 = APEX_Y + i * bandH;
    const y2 = y1 + bandH;
    const midY = (y1 + y2) / 2;

    // Use width at 30% into the band — narrowest safe zone for the foreignObject
    const safeY = i === 0 ? y1 + 0.45 * bandH : y1 + 0.15 * bandH;
    const safeW = rx(safeY) - lx(safeY);
    const foW = Math.max(safeW - 20, 40);
    const foX = APEX_X - foW / 2;
    const foH = bandH - 4;

    const color = colors[i] ?? '#374151';
    const item = items[N - 1 - i]; // tier 0=top → items[N-1]

    const points = i === 0
      ? `${APEX_X},${APEX_Y} ${rx(y2)},${y2} ${lx(y2)},${y2}`
      : `${lx(y1)},${y1} ${rx(y1)},${y1} ${rx(y2)},${y2} ${lx(y2)},${y2}`;

    // For narrow top tiers: scale down text and hide description if too cramped
    const titleSize = foW > 200 ? 16 : foW > 120 ? 13 : 10;
    const descSize  = titleSize - 3;
    const showDesc  = foW > 160; // only show description when there's enough horizontal room
    const name = item?.title || item?.desc || '';
    const desc = item?.title ? item.desc : '';

    return `<polygon points="${points}" fill="${color}"/>
    ${i < N - 1 ? `<line x1="${lx(y2)}" y1="${y2}" x2="${rx(y2)}" y2="${y2}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>` : ""}
    <foreignObject x="${foX}" y="${midY - foH / 2}" width="${foW}" height="${foH}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 4px;box-sizing:border-box;overflow:hidden">
        <div style="font-size:${titleSize}px;font-weight:800;color:#fff;line-height:1.2;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.03em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(name)}</div>
        ${showDesc && desc ? `<div style="font-size:${descSize}px;color:rgba(255,255,255,0.82);line-height:1.3;font-family:system-ui,sans-serif;margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(desc)}</div>` : ''}
      </div>
    </foreignObject>`;
  });

  return `<div class="slide py-slide">
  <div class="py-header">
    ${label(slide.headerTag)}
    <h2 class="py-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="py-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="py-body">
    <svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="py-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="${clipId}">
          <polygon points="${outlinePoints}"/>
        </clipPath>
      </defs>
      <g clip-path="url(#${clipId})">
        ${tiersSVG.join("\n        ")}
      </g>
    </svg>
    ${slide.subtitle ? `<p class="py-foot">${esc(slide.subtitle)}</p>` : ""}
  </div>
</div>`;
}

// ── CIRCULAR FLOW ──────────────────────────────────────────────────────────────
function renderCircularFlow(slide: Slide): string {
  const rawNodes = (slide.flowNodes ?? []).filter(Boolean).slice(0, 5);
  let nodes: FlowNode[] = rawNodes.length >= 3 ? rawNodes
    : (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5).map(b => {
        const p = parseBullet(b);
        return { label: p.title || p.desc, sublabel: p.title ? p.desc.split(" ").slice(0, 4).join(" ") : "" };
      });
  if (nodes.length < 3) nodes = extractFallbackSteps(slide).slice(0, 5).map(s => {
    const p = parseBullet(s);
    return { label: p.title || p.desc, sublabel: "" };
  });
  const n = Math.min(nodes.length, 5);
  if (n < 3) return renderDarkFlow(slide);

  const CX = 300, CY = 250, R_ORBIT = 145, R_NODE = 42;
  const CF_COLORS = ['#111111', '#1E293B', '#374151', '#4B5563', '#6B7280'];

  // Positions (start at top, clockwise)
  const angles = Array.from({ length: n }, (_, i) => (-Math.PI / 2) + (2 * Math.PI * i) / n);
  const positions = angles.map(a => ({
    x: CX + R_ORBIT * Math.cos(a),
    y: CY + R_ORBIT * Math.sin(a),
  }));

  // Arrow arcs between consecutive nodes (curved, staying outside the orbit ring)
  const arrows = positions.map((from, i) => {
    const to = positions[(i + 1) % n]!;
    // Control point: midpoint pushed outward from center
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = midX - CX, dy = midY - CY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = 40;
    const cpX = midX + (dx / dist) * push;
    const cpY = midY + (dy / dist) * push;
    // Start and end points: just outside node radius toward arc
    const fromAngle = Math.atan2(from.y - cpY, from.x - cpX);
    const toAngle   = Math.atan2(to.y - cpY, to.x - cpX);
    const sx = from.x - R_NODE * Math.cos(fromAngle - Math.PI);
    const sy = from.y - R_NODE * Math.sin(fromAngle - Math.PI);
    const ex = to.x - R_NODE * Math.cos(toAngle - Math.PI);
    const ey = to.y - R_NODE * Math.sin(toAngle - Math.PI);
    return `<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cpX.toFixed(1)} ${cpY.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"
      fill="none" stroke="#D1D5DB" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#cf-arrow)"/>`;
  });

  const circles = positions.map((pos, i) => {
    const nd = nodes[i]!;
    const col = CF_COLORS[i % CF_COLORS.length] ?? '#374151';
    const ico = nd.icon ?? ICON_POOL[i % ICON_POOL.length] ?? "check-circle";
    // Truncate label to fit
    const lbl = nd.label.slice(0, 18);
    return `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${R_NODE}" fill="${col}"/>
    <foreignObject x="${(pos.x - R_NODE).toFixed(1)}" y="${(pos.y - 14).toFixed(1)}" width="${R_NODE * 2}" height="28">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;text-align:center;line-height:1.2;padding:0 4px">${esc(lbl)}</div>
    </foreignObject>
    ${nd.sublabel ? `<text x="${pos.x.toFixed(1)}" y="${(pos.y + R_NODE + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="#6B7280" font-family="system-ui,sans-serif">${esc(nd.sublabel.slice(0, 20))}</text>` : ""}`;
  });

  return `<div class="slide cf-slide">
  <div class="cf-header">
    ${label(slide.headerTag)}
    <h2 class="cf-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="cf-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="cf-body">
    <svg viewBox="0 0 600 500" xmlns="http://www.w3.org/2000/svg" class="cf-svg">
      <defs>
        <marker id="cf-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#9CA3AF"/>
        </marker>
      </defs>
      ${arrows.join("\n      ")}
      ${circles.join("\n      ")}
      ${slide.subtitle ? `<text x="${CX}" y="${CY + 12}" text-anchor="middle" font-size="13" font-weight="600" fill="#374151" font-family="system-ui,sans-serif">${esc(slide.subtitle.slice(0, 25))}</text>` : ""}
    </svg>
  </div>
</div>`;
}

// ── VENN OVERLAP ───────────────────────────────────────────────────────────────
function renderVennOverlap(slide: Slide): string {
  const bullets  = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 4);
  const fnodes   = (slide.flowNodes   ?? []).filter(Boolean).slice(0, 6);

  const circleItems = bullets.length >= 3
    ? bullets.map(b => { const p = parseBullet(b); return { name: p.title || p.desc, desc: p.title ? p.desc : "" }; })
    : ["Channel A","Channel B","Channel C","Channel D"].map(n => ({ name: n, desc: "" }));

  const callouts = fnodes.length >= 2
    ? fnodes.map(n => ({ name: n.label, desc: n.sublabel ?? "" }))
    : (slide.metrics ?? []).slice(0, 6).map(m => ({ name: m.label, desc: m.value }));

  const leftCalls  = callouts.slice(0, 3);
  const rightCalls = callouts.slice(3, 6);

  const CX = 550, CY = 270, OFFSET = 85, R = 128;
  const centers = [
    { x: CX,          y: CY - OFFSET },  // top
    { x: CX + OFFSET, y: CY          },  // right
    { x: CX,          y: CY + OFFSET },  // bottom
    { x: CX - OFFSET, y: CY          },  // left
  ];
  const VCOLS = ['#6C63FF', '#2BA3BE', '#1A9E83', '#4891C9'];

  // STEP 1 — circle fills only (no text yet)
  const circleFills = centers.slice(0, Math.min(circleItems.length, 4)).map((c, i) => {
    const col = VCOLS[i % VCOLS.length] ?? '#4891C9';
    return `<circle cx="${c.x}" cy="${c.y}" r="${R}" fill="${col}" fill-opacity="0.78"/>`;
  });

  // STEP 2 — center white circle
  const centerLabel = slide.subtitle ?? "";
  const centerEl = `<circle cx="${CX}" cy="${CY}" r="52" fill="white" stroke="#E5E7EB" stroke-width="1.5"/>
    ${centerLabel ? `<text x="${CX}" y="${CY - 5}" text-anchor="middle" font-size="12" font-weight="800" fill="#111111" font-family="system-ui,sans-serif">${esc(centerLabel.split(" ").slice(0, 2).join(" ").toUpperCase())}</text>
    <text x="${CX}" y="${CY + 12}" text-anchor="middle" font-size="9" fill="#6B7280" font-family="system-ui,sans-serif">${esc(centerLabel.split(" ").slice(2, 5).join(" "))}</text>` : ""}`;

  // STEP 3 — callout lines (drawn before labels so labels sit on top)
  const leftAnchorX = 190, rightAnchorX = 910;
  const leftCallEls = leftCalls.map((c, i) => {
    const ty = 155 + i * 90;
    const lx2 = centers[3]!.x - R + 20;
    const ly2 = CY - 50 + i * 50;
    return `<line x1="${leftAnchorX + 115}" y1="${ty}" x2="${lx2}" y2="${ly2}" stroke="#D1D5DB" stroke-width="1"/>
    <text x="${leftAnchorX + 105}" y="${ty - 7}" text-anchor="end" font-size="12" font-weight="700" fill="#111111" font-family="system-ui,sans-serif">${esc(c.name)}</text>
    ${c.desc ? `<text x="${leftAnchorX + 105}" y="${ty + 10}" text-anchor="end" font-size="10" fill="#6B7280" font-family="system-ui,sans-serif">${esc(c.desc.slice(0, 38))}</text>` : ""}`;
  });

  const rightCallEls = rightCalls.map((c, i) => {
    const ty = 155 + i * 90;
    const rx2 = centers[1]!.x + R - 20;
    const ry2 = CY - 50 + i * 50;
    return `<line x1="${rightAnchorX - 115}" y1="${ty}" x2="${rx2}" y2="${ry2}" stroke="#D1D5DB" stroke-width="1"/>
    <text x="${rightAnchorX - 105}" y="${ty - 7}" text-anchor="start" font-size="12" font-weight="700" fill="#111111" font-family="system-ui,sans-serif">${esc(c.name)}</text>
    ${c.desc ? `<text x="${rightAnchorX - 105}" y="${ty + 10}" text-anchor="start" font-size="10" fill="#6B7280" font-family="system-ui,sans-serif">${esc(c.desc.slice(0, 38))}</text>` : ""}`;
  });

  // STEP 4 — circle labels LAST so they render above every circle fill
  // Each label positioned in the outer petal (away from centre of arrangement)
  const outerDirs = [
    { dx: 0,  dy: -1 },  // top circle → label moves up
    { dx: 1,  dy:  0 },  // right circle → label moves right
    { dx: 0,  dy:  1 },  // bottom circle → label moves down
    { dx: -1, dy:  0 },  // left circle → label moves left
  ];
  const PETAL_DIST = R * 0.55; // distance from circle center toward outer petal

  const circleLabelEls = centers.slice(0, Math.min(circleItems.length, 4)).map((c, i) => {
    const item = circleItems[i]!;
    const dir  = outerDirs[i] ?? { dx: 0, dy: -1 };
    const lx2  = c.x + dir.dx * PETAL_DIST;
    const ly2  = c.y + dir.dy * PETAL_DIST;
    const fw = 160, fh = 48;
    return `<foreignObject x="${lx2 - fw / 2}" y="${ly2 - fh / 2}" width="${fw}" height="${fh}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;font-weight:700;color:white;font-family:system-ui,sans-serif;line-height:1.25;text-shadow:0 1px 4px rgba(0,0,0,0.55);overflow:hidden">${esc(item.name)}</div>
    </foreignObject>`;
  });

  return `<div class="slide ve-slide">
  <div class="ve-header">
    ${label(slide.headerTag)}
    <h2 class="ve-title">${esc(slide.title ?? "")}</h2>
  </div>
  <div class="ve-body">
    <svg viewBox="0 0 1100 540" xmlns="http://www.w3.org/2000/svg" class="ve-svg">
      <!-- Layer 1: all circle fills -->
      ${circleFills.join("\n      ")}
      <!-- Layer 2: center white circle -->
      ${centerEl}
      <!-- Layer 3: callout lines & text (behind circle labels) -->
      ${leftCallEls.join("\n      ")}
      ${rightCallEls.join("\n      ")}
      <!-- Layer 4: circle labels last — always on top -->
      ${circleLabelEls.join("\n      ")}
    </svg>
  </div>
</div>`;
}

// ── PETAL DIAGRAM ─────────────────────────────────────────────────────────────
function renderPetalDiagram(slide: Slide): string {
  let bullets = (slide.bulletPoints ?? []).filter(Boolean).slice(0, 5);
  if (bullets.length === 0) bullets = (slide.flowNodes ?? []).map(n => `${n.label}${n.sublabel ? `: ${n.sublabel}` : ""}`).slice(0, 5);
  if (bullets.length === 0) bullets = extractFallbackSteps(slide).slice(0, 5);
  const n = Math.max(4, Math.min(bullets.length, 5));
  const items = bullets.slice(0, n).map(b => parseBullet(b));

  const PCOLORS = ['#4A7BA8', '#4A9B8E', '#C27803', '#A83B2A', '#5B4690'];
  const VW = 980, VH = 520;
  const CX = VW / 2, CY = VH / 2 + 10;
  const PETAL_LEN = 155, PETAL_HW = 70;
  const LABEL_DIST = PETAL_LEN + 82;
  const ICON_DIST  = PETAL_LEN * 0.63;
  const ICON_SZ    = 36;
  const ICON_NAMES = [
    "target", "settings", "zap", "users", "bar-chart",
    "shield", "message-circle", "trending-up", "star", "cpu",
  ];

  // Petal bezier: tip at origin pointing in +x direction
  const c1 = PETAL_HW * 0.5, c2 = PETAL_LEN - PETAL_HW * 0.5;
  const petalD = `M 0,0 C ${c1},-${PETAL_HW} ${c2},-${PETAL_HW} ${PETAL_LEN},0 C ${c2},${PETAL_HW} ${c1},${PETAL_HW} 0,0`;

  // Evenly spaced angles starting from top (-90°)
  const degs = Array.from({ length: n }, (_, i) => -90 + i * (360 / n));
  const rads = degs.map(d => (d * Math.PI) / 180);

  // Layer 1 — petal fills
  const petalFills = degs.map((d, i) =>
    `<path d="${petalD}" fill="${PCOLORS[i % PCOLORS.length]}" fill-opacity="0.88"
      transform="translate(${CX},${CY}) rotate(${d})"/>`
  );

  // Layer 2 — center circle
  const subtitle = slide.subtitle ?? "";
  const centerEl = `<circle cx="${CX}" cy="${CY}" r="42" fill="white" stroke="#E5E7EB" stroke-width="2"/>
    ${subtitle ? `<text x="${CX}" y="${CY + 5}" text-anchor="middle" font-size="10" font-weight="800" fill="#374151" font-family="system-ui,sans-serif">${esc(subtitle.slice(0, 14).toUpperCase())}</text>` : ""}`;

  // Layer 3 — icons inside each petal (white, centered along petal axis)
  const petalIcons = rads.map((rad, i) => {
    const ix = CX + ICON_DIST * Math.cos(rad);
    const iy = CY + ICON_DIST * Math.sin(rad);
    const icoName = ICON_NAMES[i % ICON_NAMES.length]!;
    return `<foreignObject x="${ix - ICON_SZ / 2}" y="${iy - ICON_SZ / 2}" width="${ICON_SZ}" height="${ICON_SZ}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${ICON_SZ}px;height:${ICON_SZ}px;display:flex;align-items:center;justify-content:center;color:white;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))">${icon(icoName, ICON_SZ)}</div>
    </foreignObject>`;
  });

  // Layer 4 — labels outside petals (always rendered last → on top)
  const petalLabels = rads.map((rad, i) => {
    const lx = CX + LABEL_DIST * Math.cos(rad);
    const ly = CY + LABEL_DIST * Math.sin(rad);
    const fw = 180, fh = 90;
    const item = items[i];
    const name = item?.title || item?.desc || '';
    const desc = item?.title ? item.desc : '';
    const col  = PCOLORS[i % PCOLORS.length]!;
    return `<foreignObject x="${lx - fw / 2}" y="${ly - fh / 2}" width="${fw}" height="${fh}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:system-ui,sans-serif;overflow:hidden">
        <div style="font-size:12px;font-weight:800;color:${col};line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(name)}</div>
        ${desc ? `<div style="font-size:10px;color:#6B7280;line-height:1.35;margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${esc(desc)}</div>` : ''}
      </div>
    </foreignObject>`;
  });

  return `<div class="slide pd-slide">
  <div class="pd-header">
    ${label(slide.headerTag)}
    <h2 class="pd-title">${esc(slide.title ?? "")}</h2>
    ${slide.description ? `<p class="pd-desc">${esc(slide.description)}</p>` : ""}
  </div>
  <div class="pd-body">
    <svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" class="pd-svg" preserveAspectRatio="xMidYMid meet">
      ${petalFills.join("\n      ")}
      ${centerEl}
      ${petalIcons.join("\n      ")}
      ${petalLabels.join("\n      ")}
    </svg>
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
  dark_steps:              renderDarkSteps,
  dark_comparison:         renderDarkComparison,
  dark_flow:               renderDarkFlow,
  concentric_layers:       renderConcentricLayers,
  big_numbers:             renderBigNumbers,
  split_insight:           renderSplitInsight,
  funnel_stages:           renderFunnelStages,
  arrow_pipeline:          renderArrowPipeline,
  pyramid_tiers:           renderPyramidTiers,
  circular_flow:           renderCircularFlow,
  venn_overlap:            renderVennOverlap,
  petal_diagram:           renderPetalDiagram,
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

/* ══ COMPARISON (legacy selectors kept for safety) ══ */
.comparison { flex-direction: column; background: #111111; }

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
.ig-header {
  display: flex;
  align-items: flex-start;
  gap: 2rem;
}
.ig-header-left { flex: 1; }
.ig-header-right {
  flex: 1;
  display: flex;
  align-items: center;
  padding-top: 1.5rem;
}
.ig-desc {
  font-size: 0.84rem;
  color: #4B5563;
  line-height: 1.7;
}
.icon-grid {
  flex: 1;
  display: grid;
  padding: 0 2rem 1.2rem;
  gap: 1rem;
  align-content: stretch;
}
.icon-grid.cols-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.icon-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
.icon-card {
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.ic-band {
  padding: 0.85rem 1.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.ic-icon-in-band {
  color: #fff;
  display: flex;
  align-items: center;
}
.ic-num-badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.08em;
}
.ic-card-body {
  padding: 0.85rem 1.1rem 1rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.icon-card-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.35rem;
  line-height: 1.3;
}
.icon-card-desc {
  font-size: 0.78rem;
  color: #4B5563;
  line-height: 1.6;
  flex: 1;
}

/* ══ CHALLENGE GRID ══ */
/* ── CHALLENGE GRID (stacked icon cards + image) ──────────────────────────── */
.cg-slide {
  display: flex;
  flex-direction: row;
  background: #FFFFFF;
  overflow: hidden;
}
.cg-left {
  flex: 0 0 58%;
  padding: 2.25rem 2.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cg-header { flex-shrink: 0; }
.cg-title {
  font-size: 1.55rem;
  font-weight: 700;
  color: #111111;
  margin: 0.3rem 0 0;
  line-height: 1.25;
}
.cg-desc {
  font-size: 0.82rem;
  color: #6B7280;
  margin: 0.4rem 0 0;
  line-height: 1.5;
}
.cg-cards {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  flex: 1;
}
.cg-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  border-radius: 10px;
  padding: 0.8rem 1.2rem;
}
.cg-icon-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  flex-shrink: 0;
}
.cg-card-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.cg-card-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #111111;
  margin: 0;
  line-height: 1.3;
}
.cg-card-desc {
  font-size: 0.78rem;
  color: #4B5563;
  margin: 0;
  line-height: 1.45;
}
.cg-img-panel {
  flex: 0 0 42%;
  overflow: hidden;
}
.cg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

/* ══ NUMBERED STEPS + CALLOUT (legacy — replaced by dark-steps-slide) ══ */
.steps-callout-slide { flex-direction: column; background: #111111; }

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

/* tc right-panel alternatives */
.tc-kpi-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}
.tc-kpi-row {
  padding: 0.9rem 1rem;
  border-left: 3px solid #E5E7EB;
  border-bottom: 1px solid #F3F4F6;
}
.tc-kpi-val {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.25rem;
}
.tc-kpi-lbl {
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
}
.tc-callout-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}
.tc-callout-item {
  padding: 0.75rem 1rem;
  background: #F9FAFB;
  border-radius: 4px;
}
.tc-callout-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.3rem;
}
.tc-callout-desc {
  font-size: 0.78rem;
  color: #4B5563;
  line-height: 1.55;
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

/* tf list fallback (when no flow nodes) */
.tf-list-fallback {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
  max-width: 42rem;
}
.tf-list-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}
.tf-list-num {
  font-size: 0.68rem;
  font-weight: 800;
  color: #fff;
  min-width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}
.tf-list-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #111111;
  display: block;
  margin-bottom: 0.2rem;
}
.tf-list-desc {
  font-size: 0.8rem;
  color: #4B5563;
  line-height: 1.55;
  margin: 0;
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

/* ══ LABEL (shared token for structured slides) ══ */
.dark-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: #9CA3AF;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

/* ══ COMPARISON TABLE (clean white, structured rows) ══ */
.dark-comp-slide {
  background: #ffffff;
  flex-direction: column;
  padding: 2rem 2.5rem 1.25rem;
}
.dark-comp-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.6rem;
}
.dark-comp-desc {
  font-size: 0.84rem;
  color: #4B5563;
  line-height: 1.65;
  margin-bottom: 1rem;
  max-width: 52rem;
}
.dark-comp-table-wrap {
  flex: 1;
  overflow: hidden;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.dark-comp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.dark-comp-table thead tr { background: #F8FAFC; }
.dct-th-feat, .dct-th-bad, .dct-th-good {
  padding: 0.8rem 1rem;
  text-align: left;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  border-bottom: 2px solid #E5E7EB;
}
.dct-th-feat { color: #6B7280; width: 28%; }
.dct-th-bad { color: #B91C1C; width: 36%; background: #FEF2F2; }
.dct-th-good { color: #065F46; width: 36%; background: #F0FDF4; }
.dct-tr { border-bottom: 1px solid #F3F4F6; }
.dct-tr:nth-child(even) { background: #FAFAFA; }
.dct-tr:last-child { border-bottom: none; }
.dct-td-feat {
  padding: 0.6rem 1rem;
  color: #111111;
  font-weight: 600;
}
.dct-td-bad {
  padding: 0.6rem 1rem;
  color: #6B7280;
}
.dct-td-good {
  padding: 0.6rem 1rem;
  color: #374151;
  font-weight: 500;
}

/* two-column fallback */
.dark-comp-cols {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding-top: 0.75rem;
}
.dark-comp-col-hdr {
  font-size: 0.9rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #E5E7EB;
}
.dark-comp-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #4B5563;
  padding: 0.45rem 0;
  border-bottom: 1px solid #F3F4F6;
  line-height: 1.5;
}
.dco-x { color: #DC2626; flex-shrink: 0; font-weight: 700; }
.dco-check { color: #16A34A; flex-shrink: 0; font-weight: 700; }

/* ══ NUMBERED STEPS GRID (clean white, numbered circles at cell corners) ══ */
.dark-steps-slide {
  background: #ffffff;
  flex-direction: column;
}
.ds-header {
  padding: 1.6rem 2.5rem 1rem;
  border-bottom: 1px solid #E5E7EB;
}
.ds-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.5rem;
}
.ds-desc {
  font-size: 0.84rem;
  color: #4B5563;
  line-height: 1.65;
  max-width: 52rem;
}
.ds-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  padding: 1.25rem 2rem 0.5rem;
  gap: 0;
}
.ds-cell {
  border: 1px solid #E5E7EB;
  padding: 1.75rem 1.75rem 1.5rem;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #FAFAFA;
}
.ds-num-ring {
  position: absolute;
  top: -1.4rem;
  left: 1.5rem;
  width: 2.8rem;
  height: 2.8rem;
  background: #111111;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 2px #E5E7EB;
}
.ds-num {
  font-size: 1.05rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1;
}
.ds-cell-body { margin-top: 0.75rem; }
.ds-cell-title {
  font-size: 1rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.5rem;
  line-height: 1.3;
}
.ds-cell-desc {
  font-size: 0.8rem;
  color: #4B5563;
  line-height: 1.65;
  flex: 1;
}
.ds-callout {
  display: flex;
  gap: 0.75rem;
  padding: 0.85rem 2.5rem;
  border-top: 1px solid #E5E7EB;
  align-items: flex-start;
  flex-shrink: 0;
  background: #F9FAFB;
}
.ds-callout-icon { color: #6B7280; font-size: 1rem; flex-shrink: 0; margin-top: 0.05rem; }
.ds-callout-text { font-size: 0.82rem; color: #374151; font-style: italic; line-height: 1.55; }

/* ══ LARGE FLOW (accent-colored circles, clean white) ══ */
.dark-flow-slide {
  background: #ffffff;
  flex-direction: column;
  padding: 2rem 3rem 1.5rem;
}
.df-header { margin-bottom: 1.25rem; }
.df-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: #0D0D0D;
  line-height: 1.15;
  margin-bottom: 0.5rem;
}
.df-desc {
  font-size: 0.85rem;
  color: #4B5563;
  line-height: 1.65;
  max-width: 50rem;
}
.df-flow-band {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.df-foot {
  font-size: 0.82rem;
  color: #2563EB;
  line-height: 1.65;
  margin-top: 1rem;
  font-style: italic;
  border-top: 1px solid #E5E7EB;
  padding-top: 0.75rem;
}

/* ── Concentric Layers ── */
.conc-slide {
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 0.85in 0.75in 0.6in;
}
.conc-header { margin-bottom: 0.5rem; }
.conc-title {
  font-size: 1.65rem;
  font-weight: 800;
  color: #111111;
  line-height: 1.25;
  margin-bottom: 0.35rem;
}
.conc-desc {
  font-size: 0.875rem;
  color: #6B7280;
  max-width: 58ch;
  line-height: 1.55;
}
.conc-diagram-wrap {
  flex: 1;
  min-height: 0;
}
.conc-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
  margin-top: 0.5rem;
}
.conc-card {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
}
.conc-card-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #111111;
  margin-bottom: 0.2rem;
}
.conc-card-desc {
  font-size: 0.78rem;
  color: #6B7280;
  line-height: 1.45;
}
.conc-card-desc--solo {
  font-size: 0.84rem;
  color: #111111;
  font-weight: 500;
}

/* ── BIG NUMBERS ─────────────────────────────────────────────────────────── */
.bn-slide {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  background: #FFFFFF;
  padding: 2.5rem 3rem;
  gap: 1.5rem;
}
.bn-header { width: 100%; text-align: center; }
.bn-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111111;
  margin: 0.3rem 0 0;
  line-height: 1.25;
}
.bn-desc {
  font-size: 0.9rem;
  color: #6B7280;
  margin: 0.5rem auto 0;
  max-width: 680px;
}
.bn-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 100%;
  max-width: 900px;
}
.bn-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0 2rem;
}
.bn-value {
  font-size: 4.5rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: #111111;
}
.bn-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #4B5563;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  max-width: 180px;
  text-align: center;
  line-height: 1.3;
}
.bn-divider {
  width: 1px;
  height: 100px;
  background: #E5E7EB;
  flex-shrink: 0;
}
.bn-foot {
  font-size: 0.82rem;
  color: #9CA3AF;
  margin: 0;
  font-style: italic;
}

/* ── SPLIT INSIGHT ───────────────────────────────────────────────────────── */
.si-slide {
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  padding: 2rem 2.5rem 1.5rem;
  gap: 1rem;
}
.si-top { flex-shrink: 0; }
.si-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #111111;
  margin: 0.2rem 0 0;
  line-height: 1.25;
}
.si-body {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 0;
  min-height: 0;
}
.si-left {
  flex: 1;
  background: #111111;
  border-radius: 10px 0 0 10px;
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.si-right {
  flex: 1;
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 0 10px 10px 0;
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.si-divider { width: 4px; background: #D1D5DB; flex-shrink: 0; }
.si-panel-head {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 0.5rem;
}
.si-left-head { color: #9CA3AF; }
.si-right-head { color: #6B7280; }
.si-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.si-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.82rem;
  line-height: 1.4;
}
.si-bullet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.35rem;
}
.si-dot-left { background: #6B7280; }
.si-dot-right { background: #111111; }
.si-item-title {
  font-weight: 600;
  color: inherit;
}
.si-left .si-item-title { color: #F9FAFB; }
.si-right .si-item-title { color: #111111; }
.si-item-desc {
  color: #9CA3AF;
  font-size: 0.78rem;
}
.si-right .si-item-desc { color: #6B7280; }

/* ── FUNNEL STAGES ────────────────────────────────────────────────────────── */
.fn-slide { flex-direction: row; background: #fff; overflow: hidden; }
.fn-left {
  flex: 0 0 42%;
  padding: 2.25rem 2rem 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
}
.fn-title { font-size: 1.55rem; font-weight: 700; color: #111111; margin: 0.3rem 0 0; line-height: 1.25; }
.fn-desc  { font-size: 0.82rem; color: #6B7280; margin: 0; line-height: 1.5; }
.fn-legend { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 0.5rem; }
.fn-leg-row { display: flex; align-items: flex-start; gap: 0.65rem; }
.fn-dot { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; margin-top: 3px; }
.fn-leg-text { display: flex; flex-direction: column; gap: 0.05rem; }
.fn-leg-name { font-size: 0.82rem; font-weight: 600; color: #111111; }
.fn-leg-val  { font-size: 0.75rem; color: #6B7280; }
.fn-foot { font-size: 0.75rem; color: #9CA3AF; font-style: italic; margin: 0; margin-top: 0.5rem; }
.fn-right {
  flex: 0 0 58%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 2.5rem 2rem 1rem;
}
.fn-svg { width: 100%; height: auto; }

/* ── ARROW PIPELINE ──────────────────────────────────────────────────────── */
.ap-slide { flex-direction: column; background: #fff; padding: 2rem 2.5rem 1.5rem; gap: 1.25rem; }
.ap-header { flex-shrink: 0; }
.ap-title { font-size: 1.6rem; font-weight: 700; color: #111111; margin: 0.3rem 0 0; line-height: 1.25; }
.ap-desc  { font-size: 0.82rem; color: #6B7280; margin: 0.3rem 0 0; }
.ap-arrows {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 0;
  min-height: 0;
}
.ap-arrow {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 1rem 1rem 2.75rem;
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%, 22px 50%);
  margin-left: -22px;
  gap: 0.3rem;
}
.ap-first {
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%);
  margin-left: 0;
  padding-left: 1.5rem;
}
.ap-num { font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.55); letter-spacing: 0.1em; }
.ap-step-title { font-size: 0.85rem; font-weight: 700; color: #fff; margin: 0; line-height: 1.3; }
.ap-step-desc  { font-size: 0.72rem; color: rgba(255,255,255,0.75); margin: 0; line-height: 1.35; }
.ap-callout {
  font-size: 0.82rem;
  color: #4B5563;
  padding: 0.6rem 1rem;
  background: #F3F4F6;
  border-radius: 6px;
  border-left: 3px solid #111111;
  flex-shrink: 0;
}

/* ── PYRAMID TIERS ───────────────────────────────────────────────────────── */
.py-slide { flex-direction: column; background: #fff; padding: 1.5rem 3rem 0.75rem; gap: 0.5rem; }
.py-header { flex-shrink: 0; }
.py-title { font-size: 1.6rem; font-weight: 700; color: #111111; margin: 0.25rem 0 0; line-height: 1.25; }
.py-desc  { font-size: 0.8rem; color: #6B7280; margin: 0.2rem 0 0; line-height: 1.45; }
.py-body  { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.py-svg   { width: 100%; max-width: 620px; height: auto; }
.py-foot  { font-size: 0.74rem; color: #9CA3AF; font-style: italic; margin: 0.4rem 0 0; text-align: center; }

/* ── CIRCULAR FLOW ───────────────────────────────────────────────────────── */
.cf-slide { flex-direction: column; background: #fff; padding: 1.75rem 2.5rem 1rem; gap: 0.5rem; }
.cf-header { flex-shrink: 0; }
.cf-title { font-size: 1.6rem; font-weight: 700; color: #111111; margin: 0.3rem 0 0; line-height: 1.25; }
.cf-desc  { font-size: 0.82rem; color: #6B7280; margin: 0.25rem 0 0; }
.cf-body  { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.cf-svg   { width: 100%; height: auto; max-height: 420px; }

/* ── VENN OVERLAP ────────────────────────────────────────────────────────── */
.ve-slide { flex-direction: column; background: #fff; padding: 1.5rem 1.5rem 0.5rem; gap: 0.25rem; }
.ve-header { flex-shrink: 0; }
.ve-title { font-size: 1.55rem; font-weight: 700; color: #111111; margin: 0.2rem 0 0; line-height: 1.25; }
.ve-body  { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.ve-svg   { width: 100%; height: auto; max-height: 460px; }

/* ── PETAL DIAGRAM ───────────────────────────────────────────────────────── */
.pd-slide { flex-direction: column; background: #fff; padding: 1.5rem 2rem 0.5rem; gap: 0.25rem; }
.pd-header { flex-shrink: 0; }
.pd-title { font-size: 1.55rem; font-weight: 700; color: #111111; margin: 0.2rem 0 0; line-height: 1.25; }
.pd-desc  { font-size: 0.8rem; color: #6B7280; margin: 0.2rem 0 0; }
.pd-body  { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.pd-svg   { width: 100%; height: auto; max-height: 450px; }
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
