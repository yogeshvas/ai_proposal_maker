import pptxgen from "pptxgenjs";
import path from "path";
import fs from "fs";
import type { Slide, LayoutType } from "./slide.types";
import { COLORS, FONTS, FONT_SIZES } from "./design.constants";
import { renderHeroTemplate } from "../templates/hero.template";
import { renderTwoColumnTemplate } from "../templates/twoColumn.template";
import { renderMetricsTemplate } from "../templates/metrics.template";
import { renderTimelineTemplate } from "../templates/timeline.template";
import { renderArchitectureTemplate } from "../templates/architecture.template";
import { renderImageRightTemplate } from "../templates/imageRight.template";
import { renderImageLeftTemplate } from "../templates/imageLeft.template";
import { renderComparisonTemplate } from "../templates/comparison.template";
import { renderMinimalTemplate } from "../templates/minimal.template";

const OUTPUT_DIR = path.resolve(process.cwd(), "generated");

type TemplateRenderer = (prs: pptxgen, slide: Slide) => void;

const noop: TemplateRenderer = () => {};

const LAYOUT_RENDERER_MAP: Record<LayoutType, TemplateRenderer> = {
  hero: renderHeroTemplate,
  image_right: renderImageRightTemplate,
  image_left: renderImageLeftTemplate,
  two_column: renderTwoColumnTemplate,
  metrics: renderMetricsTemplate,
  timeline: renderTimelineTemplate,
  architecture: renderArchitectureTemplate,
  comparison: renderComparisonTemplate,
  minimal: renderMinimalTemplate,
  // PDF-only layouts — PPT stubs
  icon_grid: noop,
  challenge_grid: noop,
  flow_kpi: noop,
  numbered_steps_callout: noop,
  process_donut: noop,
  staggered_phases: noop,
  tech_ecosystem: noop,
  text_chart: noop,
  text_flow: noop,
  quote_image: noop,
  dark_steps: noop,
  dark_comparison: noop,
  dark_flow: noop,
  concentric_layers: noop,
  big_numbers: noop,
  split_insight: noop,
  funnel_stages: noop,
  arrow_pipeline: noop,
  pyramid_tiers: noop,
  circular_flow: noop,
  venn_overlap: noop,
  petal_diagram: noop,
};

const SLIDE_TYPE_LAYOUT_FALLBACK: Record<string, LayoutType> = {
  cover: "hero",
  market_opportunity: "image_right",
  client_challenges: "two_column",
  solution_overview: "image_left",
  product_capabilities: "two_column",
  technical_architecture: "architecture",
  business_impact: "metrics",
  implementation_timeline: "timeline",
  pricing: "metrics",
  call_to_action: "minimal",
};

function resolveLayout(slide: Slide): LayoutType {
  if (slide.recommendedLayout && slide.recommendedLayout in LAYOUT_RENDERER_MAP) {
    return slide.recommendedLayout as LayoutType;
  }
  return SLIDE_TYPE_LAYOUT_FALLBACK[slide.slideType] ?? "minimal";
}

function initPresentation(deckTitle: string, storyTheme: string): pptxgen {
  const prs = new pptxgen();
  prs.layout = "LAYOUT_WIDE";
  prs.title = deckTitle;
  prs.subject = storyTheme;
  prs.author = "AI Proposal Engine";
  prs.company = "Enterprise AI";
  prs.revision = "1";

  prs.defineSlideMaster({
    title: "MASTER",
    background: { color: COLORS.white },
  });

  return prs;
}

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

export async function generatePPT(
  deckTitle: string,
  slides: Slide[],
  storyTheme = ""
): Promise<string> {
  ensureOutputDir();

  const prs = initPresentation(deckTitle, storyTheme);

  const sorted = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);

  for (const slide of sorted) {
    const layout = resolveLayout(slide);
    const renderer = LAYOUT_RENDERER_MAP[layout];
    renderer(prs, slide);
  }

  const fileName = `${Date.now()}.pptx`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  await prs.writeFile({ fileName: filePath });

  return filePath;
}
