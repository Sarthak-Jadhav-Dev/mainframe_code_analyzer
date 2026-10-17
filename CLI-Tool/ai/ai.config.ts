import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export async function getAgentModel() {
    const provider = createOpenRouter({apiKey: process.env.api_Key});
    const modelId = process.env.default_mode || "openrouter/free";

    return provider(modelId);

}