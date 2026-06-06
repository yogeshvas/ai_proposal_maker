import { openAIClient } from "../config/ai.client";

const LAYOUT_INTELLIGENCE_PROMPT = `You are a Visual Design Intelligence Agent for enterprise proposal decks.

Your ONLY job is to assign the best presentation layout to each slide, then return the updated slide list.

You receive a full deck blueprint. For each slide you see: slideNumber, slideType, businessObjective, narrativePurpose.
You return the same slides array with a "recommendedLayout" assigned to every slide.

━━━ AVAILABLE LAYOUTS ━━━

HERO/IMAGE LAYOUTS (use sparingly — only when a photo adds narrative value):
  hero              → Cover slide with full-bleed image LEFT, text RIGHT. Use ONLY for slide 1.
  image_left        → Photo left (40%), content right. Use for market context, opening story slides.
  image_right       → Content left, photo right. Use for case studies, closing narrative slides.
  quote_image       → Large blockquote + photo. Use for executive commitment, testimonial, CTA slides.

TEXT + DATA LAYOUTS (best for analytical content):
  text_flow         → Left: 2-paragraph insight. Right: horizontal 4-5 node flow diagram. Best for market opportunity, solution overview.
  text_chart        → Left: insights + bullets. Right: bar chart. Best for market data, benchmarks, quantified opportunity.
  two_column        → Equal left/right columns with different content. Good for contrasting two ideas.
  metrics           → 3-5 oversized KPI numbers with labels. Use for business impact, investment summary.
  minimal           → Clean text-only, no visuals. Use for pricing, quotes, simple statements.

BIG IMPACT LAYOUTS (high visual punch):
  big_numbers       → 2-3 GIANT stats centered on slide with supporting text. MOST impactful for ROI, benchmark, before/after numbers.
  split_insight     → Left: dark problem panel (challenge/pain). Right: light solution panel. Perfect for competitive positioning, transformation contrast.
  dark_flow         → 4-5 connected circles on white background. Use for solution flow, customer journey, process overview.
  dark_comparison   → Comparison table: "Old Way | New Way" rows. Use for competitive advantage, status quo vs solution.
  dark_steps        → 2×2 numbered grid. Use for 4-step methodology, use case breakdown, implementation steps.

GRID LAYOUTS (structured content):
  challenge_grid    → Grid of pain point cards with colored headers. Use ONLY for client challenges/pain points.
  icon_grid         → Grid of feature/capability cards with icons. Use for product capabilities, feature overview.
  flow_kpi          → Top: horizontal node flow. Bottom: 3 KPI metrics. Good for ROI flow, automation pipeline + results.
  numbered_steps_callout → 4 numbered steps in 2×2 + callout bar. Good for methodology, onboarding steps.

DIAGRAM LAYOUTS:
  process_donut     → Circular numbered process + 3 key metrics. Use for business impact, phased approach.
  staggered_phases  → 4-5 phase timeline with phase details. Use ONLY for implementation timeline.
  concentric_layers → 3 nested rings with callout labels + 4 cards below. Use for architecture, layered platform.
  tech_ecosystem    → Technical stack grid (6 categories). Use for integration landscape, technology overview.
  timeline          → Horizontal milestone timeline. Alternative to staggered_phases for simpler roadmaps.

FLOW & VISUAL DIAGRAM LAYOUTS (high visual impact):
  funnel_stages     → Narrowing trapezoid funnel showing 3-4 stages with values. Perfect for sales funnel, TAM/SAM/SOM, lead pipeline, conversion flow.
  arrow_pipeline    → 4-5 horizontal chevron arrows in sequence. Best for solution pipeline, process flow, implementation sequence.
  pyramid_tiers     → Triangle pyramid with 3 horizontal bands (base=mass, middle, top=premium). Use for segmentation, maturity model, priority hierarchy.
  circular_flow     → 4-5 nodes arranged in a circle connected by curved arrows. Use for continuous improvement cycle, recurring process, agile loop.
  venn_overlap      → 4 overlapping circles in cross pattern with center label and left/right callouts. Use for channel mix, ecosystem overlap, intersection of capabilities.
  petal_diagram     → 4-5 colored leaf/petal shapes arranged in a flower pattern with icons inside and labels outside. Use for 4-5 distinct strategic pillars, HR frameworks, capability wheels, or any content where each item is equally important and visually distinct.

━━━ LAYOUT SELECTION RULES (HARD RULES — ZERO EXCEPTIONS) ━━━

1. hero MUST appear exactly once — slide 1 only. NEVER assign hero to any other slide.
2. NO layout may appear more than TWICE in the entire deck.
3. NO two consecutive slides may share the same layout.
4. challenge_grid → use only for client pain point / challenge slides.
5. big_numbers → use once, for the highest-impact ROI or business case slide.
6. split_insight → use once, ideally for competitive or transformation contrast.
7. staggered_phases → use only for implementation timeline slides.
8. Spread variety: a 15-slide deck must use at least 12 distinct layouts.
9. After assigning all layouts, verify: count each layout's frequency. Fix any that exceed 2.
10. Prefer high-impact layouts (big_numbers, split_insight, dark_flow, concentric_layers, funnel_stages, pyramid_tiers) — these make decks memorable.
11. funnel_stages → only when the content has a multi-stage narrowing flow (sales, leads, market sizing).
12. pyramid_tiers → only for 3-tier hierarchy (mass/mid/premium, low/mid/high maturity, broad/narrow segmentation).
13. venn_overlap → only when 4 distinct capabilities/channels overlap and share a common center theme.
14. circular_flow → only for cyclic, repeating, or continuous processes (not linear ones — use arrow_pipeline for those).

━━━ LAYOUT → SLIDE TYPE AFFINITY (strong suggestions, not hard rules) ━━━
  cover                    → hero
  market_opportunity       → text_flow OR text_chart (alternate between decks)
  client_challenges        → challenge_grid
  solution_overview        → dark_flow OR split_insight
  product_capabilities     → icon_grid
  technical_architecture   → concentric_layers OR tech_ecosystem
  business_impact          → big_numbers OR flow_kpi OR process_donut
  implementation_timeline  → staggered_phases
  pricing                  → minimal OR metrics
  call_to_action           → quote_image
  competitive_advantage    → dark_comparison OR split_insight
  use_cases                → dark_steps OR numbered_steps_callout
  roi                      → big_numbers OR flow_kpi
  integration              → tech_ecosystem OR concentric_layers
  executive_summary        → text_chart OR two_column

━━━ OUTPUT FORMAT ━━━

Return ONLY valid JSON. No markdown. No explanation.

{
  "layouts": [
    { "slideNumber": 1, "recommendedLayout": "hero" },
    { "slideNumber": 2, "recommendedLayout": "text_flow" }
  ]
}
`;

export async function layoutSelectorAgent(
  slides: any[],
  deckTitle: string,
  storyTheme: string
): Promise<any[]> {
  try {
    const input = {
      deckTitle,
      storyTheme,
      totalSlides: slides.length,
      slides: slides.map(s => ({
        slideNumber:      s.slideNumber,
        slideType:        s.slideType,
        businessObjective: s.businessObjective ?? "",
        narrativePurpose:  s.narrativePurpose ?? "",
      })),
    };

    const response = await openAIClient.responses.create({
      model: "gpt-5-nano",
      reasoning: { effort: "low" },
      instructions: LAYOUT_INTELLIGENCE_PROMPT,
      input: `Assign optimal layouts. Return JSON only.\n${JSON.stringify(input)}`,
      text: { format: { type: "json_object" } },
    });

    const parsed = JSON.parse(response.output_text);
    const layoutMap: Record<number, string> = {};
    for (const item of parsed.layouts ?? []) {
      layoutMap[item.slideNumber] = item.recommendedLayout;
    }

    // Merge AI layout assignments back onto the slide blueprint
    return slides.map(s => ({
      ...s,
      recommendedLayout: layoutMap[s.slideNumber] ?? s.recommendedLayout,
    }));
  } catch (err: any) {
    console.error("[LayoutSelector] failed, keeping strategist layouts:", err?.message);
    return slides; // graceful fallback — keep whatever strategist assigned
  }
}
