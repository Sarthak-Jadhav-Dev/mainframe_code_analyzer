import { OpenRouter } from "@openrouter/sdk";
import { fetchKeyData } from "../stats/handler";

function formatMoney(val: unknown): string {
    const n = Number(val ?? 0);
    return isNaN(n) ? "$0.00" : `$${n.toFixed(6)}`;
}

export async function listApiKeys(ctx: { reply: (t: string, o?: object) => Promise<unknown> }) {
    const activeKey = process.env.api_Key || process.env.OPENROUTER_API_KEY || "";
    const mgtKey = process.env.management_key || "";

    const lines: string[] = [];
    lines.push("<b>📊 OpenRouter Account & API Key Stats</b>\n");

    if (activeKey) {
        const info = await fetchKeyData(activeKey);
        if (info) {
            lines.push(`<b>🔑 Operational Key:</b> <code>${info.label}</code>`);
            lines.push(`• <b>Status:</b> ${info.isFreeTier ? "🟡 Free Tier" : "🟢 Paid / BYOK"}`);
            
            if (info.freeRequests) {
                const { used, limit, remaining } = info.freeRequests;
                lines.push(`• <b>Daily Free Requests:</b> <code>${remaining}</code> remaining (used: ${used}/${limit})`);
            }

            lines.push(`• <b>Credit Balance:</b> <code>${formatMoney(info.credits)}</code>`);
            lines.push(`• <b>Account Spend:</b> <code>${formatMoney(info.totalUsage)}</code>`);
            lines.push(`\n<b>📈 Key Spend:</b>`);
            lines.push(`• <b>Today:</b> <code>${formatMoney(info.usageDaily)}</code>`);
            lines.push(`• <b>This Week:</b> <code>${formatMoney(info.usageWeekly)}</code>`);
            lines.push(`• <b>This Month:</b> <code>${formatMoney(info.usageMonthly)}</code>`);
            lines.push(`• <b>All-Time:</b> <code>${formatMoney(info.usage)}</code>\n`);
        }
    }

    if (mgtKey) {
        try {
            const openrouter = new OpenRouter({ apiKey: mgtKey });
            const keys = await openrouter.apiKeys.list();
            const list = (keys.data as any[]) || [];

            if (list.length > 0) {
                lines.push(`<b>🔐 Provisioned Sub-Keys (${list.length}):</b>`);
                list.forEach((element: any, index: number) => {
                    lines.push(`\n<b>Sub-Key #${index + 1}</b> — <code>${element.name ?? "unnamed"}</code>`);
                    lines.push(`• <b>Usage:</b> <code>${formatMoney(element.usage)}</code>`);
                    lines.push(`• <b>Hash:</b> <code>${element.hash}</code>`);
                });
            }
        } catch {
            // Ignore if management key check fails
        }
    }

    if (lines.length <= 1) {
        lines.push("<i>⚠ No OpenRouter API key found in configuration.</i>");
    }

    await ctx.reply(lines.join("\n"), {
        parse_mode: "HTML",
    });
}