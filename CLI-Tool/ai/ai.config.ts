import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export async function getAgentModel() {
    const apiKey = process.env.api_Key || process.env.OPENROUTER_API_KEY;
    const provider = createOpenRouter({ apiKey });
    const modelId = process.env.default_mode || "openrouter/free";

    return provider(modelId);

}