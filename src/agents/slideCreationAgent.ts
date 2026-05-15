import { openAIClient } from "../config/ai.client";
import { SLIDE_AGENT_PROMPT } from "../constants/fineprompt";

export const slideCreationAgent = async (analysis: JSON, storyTheme: string, currentSlideContent: any) => {
    const payload = {
        analysis,
        storyTheme,
        currentSlideContent

    }
    const response = await openAIClient.responses.create({
        model: "gpt-5-nano",

        reasoning: {
            effort: "minimal"
        },

        instructions: SLIDE_AGENT_PROMPT,

        input: `Return json.\n${JSON.stringify(payload)}`,

        text: {
            format: {
                type: "json_object"
            }
        }
    });
    const parse = JSON.parse(response.output_text)
    return parse
}