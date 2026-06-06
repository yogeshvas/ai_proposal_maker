/**
 * Renders one sample slide for every layout and saves a PDF for visual comparison.
 * Run: bun src/scripts/render-all-layouts.ts
 */
import { generatePDF } from "../renderers/pdf.renderer";

const SAMPLE_IMAGE = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80";
const CHART_BARS = [
  { label: "WhatsApp", value: 82 },
  { label: "Email",    value: 54 },
  { label: "SMS",      value: 41 },
  { label: "In-App",   value: 30 },
];
const METRICS_3 = [
  { label: "Cost Reduction",      value: "42%" },
  { label: "CSAT Improvement",    value: "3.8x" },
  { label: "Resolution Time",     value: "-65%" },
];
const BULLETS_4 = [
  "Lead Capture: Automated WhatsApp forms replace paper-based intake reducing errors by 80%",
  "Policy Onboarding: End-to-end digital onboarding in under 10 minutes via conversational flows",
  "Premium Reminders: AI-driven renewal nudges reduce lapse rate by 35% across segments",
  "Claims Support: Guided claims intake cuts resolution cycle from 7 days to 18 hours",
];
const BULLETS_6 = [
  "Omnichannel Inbox: Unified view of every customer conversation across WhatsApp, SMS, email",
  "AI-Powered Routing: Intent detection routes queries to right team with zero manual triage",
  "Smart Campaigns: Segment-targeted broadcast campaigns with real-time delivery analytics",
  "CRM Integration: Bi-directional sync with Salesforce, HubSpot and policy management systems",
  "Compliance Engine: GDPR and local data-residency controls baked into every message flow",
  "Analytics Dashboard: Live KPI monitoring with cohort-level engagement and conversion drilldowns",
];
const FLOW_NODES_4 = [
  { label: "Capture",    sublabel: "Lead intake",    icon: "inbox" },
  { label: "Qualify",    sublabel: "AI scoring",     icon: "zap" },
  { label: "Nurture",    sublabel: "WhatsApp flows", icon: "message-circle" },
  { label: "Convert",    sublabel: "Close & onboard",icon: "check-circle" },
];
const FLOW_NODES_5 = [
  { label: "Plan",    sublabel: "Define goals", icon: "clipboard" },
  { label: "Build",   sublabel: "Configure",    icon: "settings" },
  { label: "Test",    sublabel: "QA & UAT",     icon: "activity" },
  { label: "Deploy",  sublabel: "Go live",      icon: "send" },
  { label: "Monitor", sublabel: "Optimise",     icon: "bar-chart" },
];
const PHASES_4 = [
  { name: "Foundation", period: "Month 1–2",  bullets: ["Infrastructure setup","API integrations","Team onboarding","Pilot scope defined"] },
  { name: "Pilot",      period: "Month 3–4",  bullets: ["Go-live with 2 use cases","Agent training","Feedback loops","Baseline KPIs captured"] },
  { name: "Scale",      period: "Month 5–8",  bullets: ["Full rollout","Advanced automation","Campaign management","CRM sync live"] },
  { name: "Optimise",   period: "Month 9–12", bullets: ["AI model tuning","Predictive flows","Exec reporting","Expansion planning"] },
];

const slides: any[] = [

  // 1 HERO
  {
    slideNumber: 1, slideType: "cover", recommendedLayout: "hero",
    headerTag: "Confidential Proposal",
    title: "Transforming Prudential Zambia's Customer Engagement with WhatsApp AI",
    subtitle: "Powered by Marichi Commerce Platform",
    description: "A strategic roadmap to deploy conversational AI across 2.1M policyholders.",
    imageUrl: SAMPLE_IMAGE,
  },

  // 2 IMAGE LEFT
  {
    slideNumber: 2, slideType: "market_opportunity", recommendedLayout: "image_left",
    headerTag: "Market Context",
    title: "Zambia's Digital Insurance Opportunity Is Now",
    description: "Mobile-first penetration has hit 78%. Insurers moving to WhatsApp-first servicing are capturing 3x more renewals than traditional channels.",
    bulletPoints: BULLETS_4,
    imageUrl: SAMPLE_IMAGE,
    visualRequirements: { searchQuery: "africa mobile digital insurance", orientation: "portrait" },
  },

  // 3 IMAGE RIGHT
  {
    slideNumber: 3, slideType: "case_study", recommendedLayout: "image_right",
    headerTag: "Case Study",
    title: "How Sanlam Kenya Reduced Churn by 28% in 90 Days",
    description: "By deploying automated WhatsApp renewal flows, Sanlam Kenya eliminated manual follow-up calls and cut policy lapse rates dramatically.",
    bulletPoints: BULLETS_4.slice(0, 3),
    imageUrl: SAMPLE_IMAGE,
  },

  // 4 TWO COLUMN
  {
    slideNumber: 4, slideType: "solution_overview", recommendedLayout: "two_column",
    headerTag: "Solution Overview",
    title: "What Marichi Delivers for Prudential Zambia",
    subtitle: "Platform Capabilities | Business Outcomes",
    bulletPoints: BULLETS_6,
  },

  // 5 METRICS
  {
    slideNumber: 5, slideType: "business_impact", recommendedLayout: "metrics",
    headerTag: "Business Impact",
    title: "Measurable Results Across Every Dimension",
    description: "Based on comparable SADC market deployments over 12-month periods.",
    metrics: [
      { label: "Agent Workload Reduction", value: "68%" },
      { label: "Policy Renewal Uplift",    value: "2.4x" },
      { label: "Onboarding Time",          value: "< 8 min" },
      { label: "Customer CSAT",            value: "4.7 / 5" },
      { label: "Cost Per Interaction",     value: "-72%" },
    ],
  },

  // 6 TIMELINE
  {
    slideNumber: 6, slideType: "implementation_timeline", recommendedLayout: "timeline",
    headerTag: "Roadmap",
    title: "12-Month Deployment Roadmap",
    bulletPoints: [
      "Foundation & Integration: API setup, CRM sync, team onboarding",
      "Pilot Launch: 2 use cases go live — onboarding + renewal reminders",
      "Full Rollout: All 6 use cases active across agent network",
      "AI Optimisation: Predictive scoring and advanced campaign management",
    ],
  },

  // 7 ARCHITECTURE
  {
    slideNumber: 7, slideType: "technical_architecture", recommendedLayout: "architecture",
    headerTag: "Technical Architecture",
    title: "Marichi Platform Architecture",
    description: "A cloud-native, API-first architecture connecting every customer touchpoint.",
    bulletPoints: [
      "WhatsApp Business API: Meta-certified gateway with 99.95% uptime SLA",
      "AI Orchestration Layer: NLP intent detection + flow routing engine",
      "Integration Hub: Pre-built connectors for Salesforce, SAP, Core Banking",
      "Data & Analytics: Real-time dashboards with cohort and funnel analysis",
      "Compliance Vault: End-to-end encryption, audit logs, GDPR controls",
    ],
  },

  // 8 COMPARISON
  {
    slideNumber: 8, slideType: "competitive_advantage", recommendedLayout: "comparison",
    headerTag: "Competitive Comparison",
    title: "Marichi vs. Legacy Communication Platforms",
    subtitle: "Feature | Marichi | Competitors",
    bulletPoints: [
      "WhatsApp Native Integration: ✅ Full API | ❌ Limited or none",
      "AI Routing & Intent Detection: ✅ Built-in NLP | ⚠️ Add-on cost",
      "Pre-built Insurance Flows: ✅ 40+ templates | ❌ Build from scratch",
      "Regional Data Residency: ✅ SADC-compliant | ⚠️ Global only",
      "Implementation Time: ✅ 6 weeks | ❌ 6–12 months",
    ],
  },

  // 9 MINIMAL
  {
    slideNumber: 9, slideType: "pricing", recommendedLayout: "minimal",
    headerTag: "Investment",
    title: "Flexible Pricing Designed for Enterprise Scale",
    subtitle: "Platform fee + usage-based messaging — zero per-seat licence costs.",
    description: "Starting from $3,200/month for up to 500,000 interactions. Volume pricing available for 1M+ monthly interactions.",
  },

  // 10 ICON GRID
  {
    slideNumber: 10, slideType: "product_capabilities", recommendedLayout: "icon_grid",
    headerTag: "Platform Capabilities",
    title: "Six Core Capabilities That Drive Results",
    subtitle: "Everything you need to automate customer engagement end-to-end.",
    bulletPoints: BULLETS_6,
  },

  // 11 CHALLENGE GRID
  {
    slideNumber: 11, slideType: "client_challenges", recommendedLayout: "challenge_grid",
    headerTag: "Prudential Zambia — Challenge",
    title: "Prudential Zambia: Current Customer Engagement Pain Points",
    description: "Four critical friction points slowing growth and increasing operational cost across the policyholder lifecycle.",
    bulletPoints: [
      "Fragmented Channels: Lead intake scattered across agents, branches, and manual forms with no unified view",
      "Manual Onboarding: Policy setup requires 3–5 days of back-and-forth paperwork and agent intervention",
      "Lapsed Renewals: Premium reminders rely on outbound calls — 34% lapse rate for mid-segment policies",
      "Servicing Delays: Claims queries handled by email and phone with 7-day average resolution time",
    ],
    imageUrl: SAMPLE_IMAGE,
  },

  // 12 FLOW KPI
  {
    slideNumber: 12, slideType: "roi", recommendedLayout: "flow_kpi",
    headerTag: "ROI Flow",
    title: "From Lead to Loyal: The WhatsApp Commerce Pipeline",
    description: "Every stage automated — every stage measured.",
    flowNodes: FLOW_NODES_4,
    metrics: METRICS_3,
    bulletPoints: [
      "42% reduction in cost per policy",
      "3.8x improvement in CSAT",
      "65% faster resolution time",
    ],
  },

  // 13 NUMBERED STEPS CALLOUT
  {
    slideNumber: 13, slideType: "use_cases", recommendedLayout: "numbered_steps_callout",
    headerTag: "Use Cases",
    title: "Four WhatsApp Commerce Use Cases for Prudential Zambia",
    description: "Each use case maps directly to a measurable revenue or efficiency outcome.",
    subtitle: "Step-by-step workflows turning conversations into outcomes across onboarding, renewals, and service",
    bulletPoints: BULLETS_4,
  },

  // 14 PROCESS DONUT
  {
    slideNumber: 14, slideType: "business_impact", recommendedLayout: "process_donut",
    headerTag: "Business Impact",
    title: "Marichi's 5-Step Value Delivery Model",
    description: "A structured approach to measurable outcomes — from day one to full optimisation.",
    bulletPoints: [
      "Diagnose: Map current workflows and identify highest-impact automation opportunities",
      "Design: Co-create conversation flows with your product and compliance teams",
      "Deploy: Launch on WhatsApp Business API with full integration testing",
      "Measure: Track KPIs in real-time across engagement, conversion, and satisfaction",
      "Optimise: Continuous AI model improvement based on interaction data",
    ],
    metrics: METRICS_3,
  },

  // 15 STAGGERED PHASES
  {
    slideNumber: 15, slideType: "implementation_timeline", recommendedLayout: "staggered_phases",
    headerTag: "Implementation Roadmap",
    title: "12-Month Phased Deployment Plan",
    description: "A proven rollout methodology minimising disruption while maximising speed to value.",
    phases: PHASES_4,
  },

  // 16 TECH ECOSYSTEM
  {
    slideNumber: 16, slideType: "integration", recommendedLayout: "tech_ecosystem",
    headerTag: "Integration Ecosystem",
    title: "Marichi Integrates Across Your Full Technology Stack",
    description: "Pre-built connectors. Zero custom development needed for standard enterprise systems.",
    bulletPoints: [
      "CRM: Salesforce, HubSpot, Microsoft Dynamics",
      "Core Banking: Temenos, Oracle FLEXCUBE, Mambu",
      "Policy Admin: RiskPoint, Guidewire, Duck Creek",
      "Messaging: WhatsApp Business API, SMS, Email, RCS",
      "Analytics: Tableau, Power BI, Looker, native dashboards",
      "Security & Compliance: GDPR, POPIA, ISO 27001, SOC 2",
    ],
  },

  // 17 TEXT CHART
  {
    slideNumber: 17, slideType: "market_opportunity", recommendedLayout: "text_chart",
    headerTag: "Market Data",
    title: "WhatsApp Is the Dominant Channel Across SADC Insurance Markets",
    description: "Open rates on WhatsApp business messages average 94% versus 18% for email. Insurers ignoring this channel are leaving renewal revenue on the table.",
    bulletPoints: [
      "Reach: WhatsApp reaches 78% of Zambia's smartphone users",
      "Engagement: 94% average open rate vs 18% for email campaigns",
      "Conversion: 3.2x higher policy renewal rate on WhatsApp vs. outbound call",
      "Cost: 60% lower cost-per-interaction than traditional call centre",
    ],
    chartBars: CHART_BARS,
    metrics: METRICS_3,
  },

  // 18 TEXT FLOW
  {
    slideNumber: 18, slideType: "solution_overview", recommendedLayout: "text_flow",
    headerTag: "Solution Architecture",
    title: "Marichi Connects Every Touchpoint in the Customer Lifecycle",
    description: "From first inquiry to annual renewal, Marichi orchestrates the entire insurance customer journey on WhatsApp — with AI ensuring every interaction is personalised, compliant, and conversion-optimised.",
    subtitle: "A unified platform replacing fragmented point solutions and manual agent workflows.",
    flowNodes: FLOW_NODES_4,
  },

  // 19 QUOTE IMAGE
  {
    slideNumber: 19, slideType: "call_to_action", recommendedLayout: "quote_image",
    headerTag: "Executive Endorsement",
    title: "The Competitive Window Is Now",
    subtitle: "WhatsApp-first insurers in Kenya and Ghana are already capturing 30% more renewals. Prudential Zambia can lead this shift in the Zambian market — or follow it.",
    bulletPoints: [
      "First-mover advantage in Zambia's WhatsApp insurance market",
      "Full deployment achievable within 90 days",
      "Dedicated Marichi implementation team assigned from day one",
    ],
    imageUrl: SAMPLE_IMAGE,
  },

  // 20 DARK STEPS
  {
    slideNumber: 20, slideType: "use_cases", recommendedLayout: "dark_steps",
    headerTag: "Implementation Method",
    title: "Marichi's Four-Step Activation Framework",
    description: "A structured deployment methodology proven across 40+ enterprise insurance deployments.",
    subtitle: "Average time-to-value: 6 weeks from contract signature to first live use case",
    bulletPoints: [
      "Discover & Design: Deep-dive workshops to map your customer journeys and identify top 3 automation use cases with highest ROI potential",
      "Build & Integrate: Our engineers connect Marichi to your CRM, policy admin, and core banking systems using pre-built connectors — no custom dev required",
      "Test & Train: Parallel UAT with your team, compliance review of all flows, agent training on the unified inbox and escalation protocols",
      "Launch & Optimise: Go-live with real-time KPI monitoring, weekly performance reviews, and continuous AI model improvement over 90 days",
    ],
  },

  // 21 DARK COMPARISON
  {
    slideNumber: 21, slideType: "competitive_advantage", recommendedLayout: "dark_comparison",
    headerTag: "Status Quo vs. Marichi",
    title: "The Cost of Staying with Legacy Systems",
    bulletPoints: [
      "Customer Onboarding: 5-day manual process | WhatsApp flow completes in 8 minutes",
      "Renewal Reminders: Outbound call centre at $4.20/contact | Automated WhatsApp at $0.12/contact",
      "Claims Intake: 7-day email thread average | Guided WhatsApp form resolved in 18 hours",
      "Agent Productivity: 40 interactions/day per agent | 340 interactions/day with AI assist",
      "CSAT Score: 3.1 / 5 average | 4.7 / 5 on WhatsApp-first journeys",
    ],
  },

  // 22 DARK FLOW
  {
    slideNumber: 22, slideType: "solution_overview", recommendedLayout: "dark_flow",
    headerTag: "Solution Flow",
    title: "End-to-End WhatsApp Commerce Flow",
    description: "From first contact to closed policy — a fully automated, AI-powered conversation pipeline.",
    flowNodes: FLOW_NODES_5,
    subtitle: "Every step measurable. Every handoff automated.",
  },

  // 23 CONCENTRIC LAYERS
  {
    slideNumber: 23, slideType: "technical_architecture", recommendedLayout: "concentric_layers",
    headerTag: "Platform Architecture",
    title: "Three-Layer Marichi WhatsApp Commerce Architecture",
    description: "A platform built in concentric layers — each layer amplifying the capabilities below it.",
    flowNodes: [
      { label: "WhatsApp Channel",    sublabel: "Customer touchpoint", icon: "message-circle" },
      { label: "Automation Engine",   sublabel: "Workflow orchestration", icon: "zap" },
      { label: "AI Intelligence Core",sublabel: "NLP + decisioning", icon: "cpu" },
    ],
    bulletPoints: [
      "Policy Bot: Guides new customers through onboarding in under 8 minutes via WhatsApp",
      "Renewal Engine: Automated premium reminders with payment link — zero agent intervention",
      "Claims Intake: Structured claims form via WhatsApp cutting resolution from 7 days to 18 hours",
      "CRM Sync: Every interaction logged to Salesforce in real time with full audit trail",
    ],
  },

  // 24 BIG NUMBERS
  {
    slideNumber: 24, slideType: "roi", recommendedLayout: "big_numbers",
    headerTag: "ROI Summary",
    title: "The Numbers That Matter for Prudential Zambia",
    description: "Projected outcomes based on comparable SADC market deployments over a 12-month period.",
    subtitle: "Source: Marichi internal benchmarks, Zambia Insurance Association 2024 data",
    metrics: [
      { label: "Reduction in Cost Per Interaction",  value: "72%" },
      { label: "Policy Renewal Uplift",              value: "2.4x" },
      { label: "Time to Full Deployment",            value: "6 wks" },
    ],
  },

  // 25 SPLIT INSIGHT
  {
    slideNumber: 25, slideType: "competitive_advantage", recommendedLayout: "split_insight",
    headerTag: "Competitive Positioning",
    title: "Why Marichi Beats Every Alternative for Prudential Zambia",
    subtitle: "Status Quo | With Marichi",
    bulletPoints: [
      "Fragmented Channels: Customer data siloed across 4+ systems with no single view",
      "Manual Onboarding: Agents spend 3 hours per policy on data entry and follow-up",
      "High Lapse Rate: 34% policy lapse rate due to inconsistent renewal communication",
      "Unified Platform: Single WhatsApp inbox with full customer history and AI context",
      "8-Minute Onboarding: End-to-end digital policy enrollment with zero paperwork",
      "Automated Renewals: AI-triggered reminders reduce lapse rate to under 11% in 90 days",
    ],
  },

  // 26 FUNNEL STAGES
  {
    slideNumber: 26, slideType: "market_opportunity", recommendedLayout: "funnel_stages",
    headerTag: "Market Sizing",
    title: "Prudential Zambia's WhatsApp Addressable Opportunity",
    description: "From total mobile-connected population to immediately addressable WhatsApp policy base — a clear path to market leadership.",
    subtitle: "Marichi's TAM capture model — 18-month horizon",
    metrics: [
      { label: "Total Mobile Users in Zambia",   value: "11.2M" },
      { label: "WhatsApp Active Users",           value: "6.8M" },
      { label: "Insurance-Adjacent Population",   value: "2.1M" },
      { label: "Prudential Target Segment",       value: "380K" },
    ],
  },

  // 27 ARROW PIPELINE
  {
    slideNumber: 27, slideType: "solution_overview", recommendedLayout: "arrow_pipeline",
    headerTag: "Solution Pipeline",
    title: "Marichi's WhatsApp Commerce Delivery Pipeline",
    description: "A fully automated sequence — from raw lead to active policyholder — with AI at every handoff.",
    subtitle: "Average pipeline cycle: 8 minutes from first message to policy confirmation",
    bulletPoints: [
      "Capture: WhatsApp opt-in form collects lead details with instant AI qualification score",
      "Qualify: NLP engine scores intent and routes to correct product flow automatically",
      "Propose: Personalised policy recommendation delivered as interactive WhatsApp message",
      "Onboard: Digital KYC, document upload, and e-signature all within WhatsApp thread",
      "Retain: Automated renewal nudges, policy updates, and claims support post-issuance",
    ],
  },

  // 28 PYRAMID TIERS
  {
    slideNumber: 28, slideType: "market_opportunity", recommendedLayout: "pyramid_tiers",
    headerTag: "Customer Segmentation",
    title: "Prudential Zambia: Three-Tier Customer Engagement Strategy",
    description: "A differentiated WhatsApp engagement model tailored to each customer value segment.",
    subtitle: "Segment-specific automation depth scales with customer lifetime value",
    bulletPoints: [
      "Mass Market Base: 1.8M entry-level policy holders — automated renewals and basic claims support via WhatsApp broadcast",
      "Mid-Market Segment: 280K mid-value customers — personalised WhatsApp journeys with AI-driven upsell and cross-sell flows",
      "Premium Tier: 42K high-value clients — dedicated agent-assist with AI context, concierge WhatsApp service and real-time advisor routing",
    ],
  },

  // 29 CIRCULAR FLOW
  {
    slideNumber: 29, slideType: "solution_overview", recommendedLayout: "circular_flow",
    headerTag: "Continuous Improvement",
    title: "Marichi's AI Learning Loop: Always Getting Smarter",
    description: "Every customer interaction feeds the AI model — creating a self-improving cycle that continuously optimises engagement, conversion, and satisfaction.",
    subtitle: "AI Core",
    flowNodes: FLOW_NODES_5,
  },

  // 30 VENN OVERLAP
  {
    slideNumber: 30, slideType: "product_capabilities", recommendedLayout: "venn_overlap",
    headerTag: "Platform Ecosystem",
    title: "Key Components of Marichi's WhatsApp Commerce Ecosystem",
    subtitle: "AI CORE",
    bulletPoints: [
      "Earned Engagement: Organic referrals, viral policy sharing, WOM via WhatsApp status",
      "Shared Intelligence: AI insights shared across agent network for consistent advice",
      "Owned Channels: WhatsApp Business number, policy portal, and mobile app",
      "Paid Acquisition: Click-to-WhatsApp ads, SMS broadcast, influencer-driven campaigns",
    ],
    flowNodes: [
      { label: "Referral Programs",      sublabel: "Agent-led viral campaigns" },
      { label: "Community Groups",       sublabel: "WhatsApp policyholder communities" },
      { label: "Partner Co-marketing",   sublabel: "Bank and employer tie-ups" },
      { label: "Click-to-WhatsApp Ads",  sublabel: "Meta-targeted lead capture" },
      { label: "Broadcast Campaigns",    sublabel: "Segmented renewal messages" },
      { label: "Personalised Outreach",  sublabel: "AI-triggered lifecycle messages" },
    ],
  },
  // 31 PETAL DIAGRAM
  {
    slideNumber: 31, slideType: "product_capabilities", recommendedLayout: "petal_diagram",
    headerTag: "Platform Pillars",
    title: "Five Pillars of the Marichi WhatsApp Commerce Platform",
    description: "Each pillar independently delivers value — together they form a unified intelligence layer for insurance customer engagement.",
    subtitle: "AI CORE",
    bulletPoints: [
      "Conversational AI: Natural language understanding routes and resolves 80% of queries without human intervention",
      "Automation Engine: End-to-end workflow automation from lead capture to policy issuance and renewal",
      "Analytics & Insights: Real-time engagement dashboards with cohort analysis and predictive churn signals",
      "Integration Layer: Pre-built connectors to CRM, core banking, and policy admin systems in under 6 weeks",
      "Compliance Vault: GDPR-ready audit logs, data residency controls, and end-to-end encryption by default",
    ],
  },
];

async function main() {
  console.log(`Rendering ${slides.length} layout samples...`);
  const outPath = await generatePDF("Layout Showcase — All Templates", slides, "enterprise");
  console.log("✓ PDF saved →", outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
