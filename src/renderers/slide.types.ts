export interface SlideMetric {
  label: string;
  value: string;
}

export interface VisualRequirements {
  searchQuery: string;
  orientation: "landscape" | "portrait" | "square";
  style: string;
}

export interface FlowNode {
  label: string;
  sublabel?: string;
  icon?: string;  // Lucide icon name, e.g. "message-circle", "users", "zap"
}

export interface ChartBar {
  label: string;
  value: number;
}

export interface Phase {
  name: string;
  period: string;
  bullets: string[];
}

export interface Slide {
  slideNumber: number;
  slideType: string;
  recommendedLayout?: string;
  headerTag?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  bulletPoints?: string[];
  metrics?: SlideMetric[];
  flowNodes?: FlowNode[];
  chartBars?: ChartBar[];
  phases?: Phase[];
  visualRequirements?: VisualRequirements;
  imageUrl?: string;
}

export interface DeckPayload {
  deckTitle: string;
  storyTheme: string;
  slides: Slide[];
}

export type LayoutType =
  | "hero"
  | "image_left"
  | "image_right"
  | "two_column"
  | "metrics"
  | "timeline"
  | "architecture"
  | "comparison"
  | "minimal"
  | "icon_grid"
  | "challenge_grid"
  | "flow_kpi"
  | "numbered_steps_callout"
  | "process_donut"
  | "staggered_phases"
  | "tech_ecosystem"
  | "text_chart"
  | "text_flow"
  | "quote_image";
