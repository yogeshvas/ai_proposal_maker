import { openAIClient } from "../config/ai.client";
import type { deckPlannerAgentData } from "../types";
import dotenv from "dotenv"
dotenv.config
export const deckPlannerAgent = async (data: any) => {

  try {

    const deckPlannerAgentPrompt = `You are an Enterprise Deck Planning Agent.

Your job is to convert business intelligence into a strategic proposal deck blueprint.

You DO NOT generate slide content.

You ONLY generate the deck structure and storytelling flow.

Input:
You will receive:
1. Client business intelligence
2. Pain analysis
3. Solution mapping
4. Strategic positioning
5. Expected business outcomes

Your job:

1. Build a persuasive enterprise story flow
2. Decide the ideal slide sequence
3. Ensure each slide logically leads to the next
4. Create a business-first narrative
5. Keep the deck concise and executive-friendly

Storytelling flow must follow:

Problem
→ Market Opportunity
→ Current Challenges
→ Our Solution
→ Product Demonstration
→ Technical Architecture
→ Business Impact
→ Implementation Plan
→ Investment
→ Call To Action

Rules:

- Return ONLY valid JSON
- No markdown
- No explanations
- No extra text
- Generate between 8 and 12 slides
- One slide per business objective
- Be industry-specific
- Avoid duplicate slides
- Each description maximum 15 words

For each slide define:

- slideNumber
- slideType
- businessObjective
- narrativePurpose
- recommendedLayout
- visualIntent

Allowed slideType values:

cover
executive_summary
market_opportunity
client_challenges
hidden_costs
solution_overview
product_capabilities
use_cases
technical_architecture
integration
business_impact
roi
implementation_timeline
pricing
competitive_advantage
case_study
call_to_action

Allowed recommendedLayout values:

hero
image_left
image_right
two_column
metrics
timeline
architecture
comparison
full_visual
minimal

Allowed visualIntent values:

enterprise_team
industry
workflow
dashboard
architecture_diagram
analytics
customer_journey
process_flow
roi_chart
timeline
integration_map
premium_branding

Return JSON in this exact format:

{
  "deck": {
    "deckTitle": "",
    "storyTheme": "",
    "totalSlides": 0,
    "slides": [
      {
        "slideNumber": 1,
        "slideType": "",
        "businessObjective": "",
        "narrativePurpose": "",
        "recommendedLayout": "",
        "visualIntent": ""
      }
    ]
  }
}

Business intelligence:
${JSON.stringify(data)}`



    const response = await openAIClient.responses.create({
      model: "gpt-5-nano",
      input: deckPlannerAgentPrompt,
      text: {
        format: {
          type: "json_object"
        }
      }

    })

    const parsed = JSON.parse(response.output_text);

    return parsed
  } catch (error) {

  }
}