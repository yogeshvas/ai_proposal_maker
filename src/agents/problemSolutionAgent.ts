
import { openAIClient } from "../config/ai.client";
import type { ProposalData } from "../types";




export const problemSolutionAgent = async (data: ProposalData) => {
    try {
        // const response = await client.responses.create({
        //     model: "gpt-5-mini",
        //     input: "You are a ai proposal maker"
        // })
        const prompt = `You are an Enterprise Proposal Intelligence Agent.

Analyze the client business.

Identify:
- client summary
- industry insights
- explicit pains
- hidden pains
- business risks
- product to pain mapping
- strategic positioning
- expected outcomes

Rules:
- Industry specific
- No invented features
- Maximum 15 words per field
- Maximum 3 items per list
- Return JSON only

Client data:
${JSON.stringify(data)}`

        const fPrompt = prompt.replace("{{JSON_DATA}}", JSON.stringify(data))
        const response = await openAIClient.responses.create({
            model: "gpt-5-nano",
            input: fPrompt,
            reasoning: {
                effort: "minimal"
            },
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