import { openAIClient } from "../config/ai.client";
import { STRATEGIST_PROMPT } from "../constants/fineprompt";

export const proposalAgentStrategist = async (userNeedData: any, noOfSlides: number = 15) => {
    console.log("we came to pAs")
    try {
        const compactData = {
            noOfSlides,
            product: {
                name: userNeedData.productName,
                description: userNeedData.productDescription
            },
            client: {
                name: userNeedData.companyName,
                description: userNeedData.companyDescription,
                context: userNeedData.clientContext,
            },
            industry: userNeedData.industry,
            subIndustry: userNeedData.subIndustry,
            subSubIndustry: userNeedData.subSubIndustry,
            pains: userNeedData.painPoint,
            metadata: {
                clientName: userNeedData.metaData?.clientName,
                region: userNeedData.metaData?.region,
                targetAudience: userNeedData.metaData?.targetAudience,
                companySize: userNeedData.metaData?.companySize,
                budgetRange: userNeedData.metaData?.budgetRange,
                proposalType: userNeedData.metaData?.proposalType,
                expectedOutcome: userNeedData.metaData?.expectedOutcome,
                brandTone: userNeedData.metaData?.brandTone,
                salesObjective: userNeedData.metaData?.salesObjective,
                primaryUseCases: userNeedData.metaData?.primaryUseCases,
                integrationNeeds: userNeedData.metaData?.integrationNeeds,
            },
        };


        const response = await openAIClient.responses.create({
            model: "gpt-5-nano",

            reasoning: {
                effort: "minimal"
            },

            instructions: STRATEGIST_PROMPT,

            input: `Return JSON.\n${JSON.stringify(compactData)}`,

            text: {
                format: {
                    type: "json_object"
                }
            }
        });

        const parse = JSON.parse(response.output_text)
        return parse
    } catch (error: any) {
        console.error("[proposalAgentStrategist]", error?.message ?? error)
        throw error
    }
}