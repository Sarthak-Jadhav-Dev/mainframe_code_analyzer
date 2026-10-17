import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
    apiKey: process.env.management_key
})

export async function listApiKeys(ctx: { reply: (t: string, o?: object) => Promise<unknown> }) {
    const keys = await openrouter.apiKeys.list()
    const arrayOfApiKeys = keys.data;
    const replyText = arrayOfApiKeys
        .map((element: any, index: number) => `
<b>🔑 API Key ${index + 1}</b>

<b>General Data</b>
• <b>Created At:</b> <code>${element.createdAt}</code>
• <b>Updated At:</b> <code>${element.updatedAt ?? "N/A"}</code>
• <b>Hash Key:</b> <code>${element.hash}</code>
• <b>Name:</b> <code>${element.name}</code>

<b>Usage Data</b>
• <b>Usage:</b> <code>${element.usage}</code>
• <b>Daily:</b> <code>${element.usageDaily ?? 0}</code>
• <b>Weekly:</b> <code>${element.usageWeekly ?? 0}</code>
• <b>Monthly:</b> <code>${element.usageMonthly ?? 0}</code>

────────────────────
`)
        .join("\n");

    await ctx.reply(replyText, {
        parse_mode: "HTML",
    });
    return;
}