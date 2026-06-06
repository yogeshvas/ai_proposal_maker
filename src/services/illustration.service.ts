import path from "path";
import fs from "fs";
import { openAIClient as openai } from "../config/ai.client";

export const IMAGES_DIR = path.resolve(process.cwd(), "generated/images");

function ensureDir() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

// Visual subject per slide type
const TOPIC_MAP: Record<string, string> = {
  cover:                   "smartphone with chat message bubbles and insurance shield badge, floating notification icons",
  market_opportunity:      "expanding funnel with upward growth arrows, network nodes radiating outward",
  client_challenges:       "scattered disconnected nodes, tangled wires, isolated silos, stacked paper",
  solution_overview:       "central hub radiating clean connections to multiple channels, automated pipeline",
  product_capabilities:    "modular feature blocks snapping together, connected product grid",
  technical_architecture:  "layered cloud stack with server nodes and API connector lines",
  business_impact:         "rising bar chart, upward trend arrow, success metric dashboard",
  implementation_timeline: "horizontal roadmap with milestone markers and phase steps",
  pricing:                 "three tiered pricing cards side by side, value scale",
  call_to_action:          "two hands reaching toward each other, forward arrow, partnership",
  competitive_advantage:   "balance scales comparing two sides, winner highlighted",
  use_cases:               "four scenario panels in a 2x2 grid, workflow steps",
  roi:                     "financial growth chart, coin stack, return on investment arrow",
  integration:             "central hub connected to multiple platform nodes via clean lines",
  hidden_costs:            "iceberg with small visible tip and large submerged mass",
  case_study:              "before and after split panel, transformation visual",
  executive_summary:       "executive briefing dashboard with insight cards",
};

function buildPrompt(slideType: string, title: string): string {
  const topic = TOPIC_MAP[slideType] ?? "professional enterprise software, clean workspace";
  return [
    "Minimalist flat vector illustration for a premium enterprise business presentation.",
    `Visual subject: ${topic}.`,
    `Context: ${title.slice(0, 80)}.`,
    "Style: modern flat design, clean geometric shapes, isometric depth, soft shadows.",
    "Color palette: white or very light gray background, dark charcoal primary shapes, slate blue accent.",
    "NO text, NO words, NO letters, NO logos, NO realistic human faces.",
    "Quality: polished, McKinsey-deck level.",
  ].join(" ");
}

export interface IllustrationResult {
  fileUrl:  string;  // file:// path for Puppeteer
  httpPath: string;  // /images/<filename> — served by Express
  fileName: string;
}

export async function generateIllustration(
  slideType: string,
  title: string
): Promise<IllustrationResult | null> {
  ensureDir();

  const prompt = buildPrompt(slideType, title);
  console.log("[Illustration] generating via gpt-image-1:", slideType);

  const response = await (openai as any).images.generate({
    model:   "gpt-image-1",
    prompt,
    n:       1,
    size:    "1536x1024",
    quality: "medium",
  });

  const imageData = response?.data?.[0];
  if (!imageData) throw new Error("No image data in response");

  let b64: string;

  if (imageData.b64_json) {
    b64 = imageData.b64_json;
  } else if (imageData.url) {
    const res = await fetch(imageData.url);
    const buf = await res.arrayBuffer();
    b64 = Buffer.from(buf).toString("base64");
  } else {
    throw new Error("No url or b64_json in response");
  }

  // Save to disk for browser preview
  const titleSlug = slugify(title || slideType);
  const fileName  = `${Date.now()}_${slideType}_${titleSlug}.png`;
  const filePath  = path.join(IMAGES_DIR, fileName);
  await Bun.write(filePath, Buffer.from(b64, "base64"));

  console.log("[Illustration] saved →", fileName);

  return {
    // data URI embeds directly in HTML — Puppeteer loads it with no file:// restrictions
    fileUrl:  `data:image/png;base64,${b64}`,
    httpPath: `/images/${fileName}`,
    fileName,
  };
}
