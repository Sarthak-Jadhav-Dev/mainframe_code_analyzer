import { OpenRouter } from "@openrouter/sdk";
import chalk from "chalk";

const CYAN   = chalk.hex("#00d4ff");
const PURPLE = chalk.hex("#a855f7");
const YELLOW = chalk.hex("#facc15");
const GREEN  = chalk.hex("#4ade80");
const DIM    = chalk.dim;
const BOLD   = chalk.bold;

function formatMoney(val: unknown): string {
    const n = Number(val ?? 0);
    return isNaN(n) ? "$0.00" : `$${n.toFixed(6)}`;
}

export interface KeyStatsInfo {
    label: string;
    isFreeTier: boolean;
    freeRequests?: { used: number; limit: number; remaining: number };
    usage: number;
    usageDaily: number;
    usageWeekly: number;
    usageMonthly: number;
    credits?: number;
    totalUsage?: number;
}

export async function fetchKeyData(apiKey: string): Promise<KeyStatsInfo | null> {
    try {
        const [authRes, credRes] = await Promise.all([
            fetch("https://openrouter.ai/api/v1/auth/key", {
                headers: { Authorization: `Bearer ${apiKey}` },
            }),
            fetch("https://openrouter.ai/api/v1/credits", {
                headers: { Authorization: `Bearer ${apiKey}` },
            }),
        ]);

        const authJson = await authRes.json() as any;
        const credJson = await credRes.json() as any;

        const data = authJson?.data;
        if (!data) return null;

        return {
            label: data.label ?? "Default Key",
            isFreeTier: Boolean(data.is_free_tier),
            freeRequests: data.free_model_daily_requests,
            usage: Number(data.usage ?? 0),
            usageDaily: Number(data.usage_daily ?? 0),
            usageWeekly: Number(data.usage_weekly ?? 0),
            usageMonthly: Number(data.usage_monthly ?? 0),
            credits: Number(credJson?.data?.total_credits ?? 0),
            totalUsage: Number(credJson?.data?.total_usage ?? 0),
        };
    } catch {
        return null;
    }
}

export async function listApiKeys(): Promise<void> {
    const activeKey = process.env.api_Key || process.env.OPENROUTER_API_KEY || "";
    const mgtKey = process.env.management_key || "";

    console.log();
    console.log(PURPLE.bold("  ╔════════════════════════════════════════════════════════════╗"));
    console.log(PURPLE.bold("  ║  ") + CYAN.bold("OPENROUTER ACCOUNT & API KEY STATS") + PURPLE.bold("                ║"));
    console.log(PURPLE.bold("  ╚════════════════════════════════════════════════════════════╝"));
    console.log();

    // 1. Fetch Primary / Operational Key
    if (activeKey) {
        const info = await fetchKeyData(activeKey);
        if (info) {
            console.log(PURPLE("  ┌─────────────────────────────────────────────────────────────"));
            console.log(PURPLE("  │ ") + CYAN.bold("Active Operational Key") + DIM(`  (${info.label})`));
            console.log(PURPLE("  ├─────────────────────────────────────────────────────────────"));
            console.log(PURPLE("  │ ") + BOLD("Tier Status     ") + (info.isFreeTier ? YELLOW("Free Tier") : GREEN("Paid / BYOK")));
            
            if (info.freeRequests) {
                const { used, limit, remaining } = info.freeRequests;
                const remColor = remaining > 10 ? GREEN : remaining > 0 ? YELLOW : chalk.red;
                console.log(PURPLE("  │ ") + BOLD("Free Daily Quota ") + remColor(`${remaining} remaining`) + DIM(` (used: ${used} / limit: ${limit})`));
            }

            console.log(PURPLE("  │ ") + BOLD("Credit Balance  ") + GREEN(formatMoney(info.credits)));
            console.log(PURPLE("  │ ") + BOLD("Total Spend     ") + chalk.bold.white(formatMoney(info.totalUsage)));
            console.log(PURPLE("  ├─────────────────────────────────────────────────────────────"));
            console.log(PURPLE("  │ ") + BOLD("Daily Usage     ") + GREEN(formatMoney(info.usageDaily)));
            console.log(PURPLE("  │ ") + BOLD("Weekly Usage    ") + GREEN(formatMoney(info.usageWeekly)));
            console.log(PURPLE("  │ ") + BOLD("Monthly Usage   ") + YELLOW(formatMoney(info.usageMonthly)));
            console.log(PURPLE("  │ ") + BOLD("Lifetime Usage  ") + chalk.bold.white(formatMoney(info.usage)));
            console.log(PURPLE("  └─────────────────────────────────────────────────────────────"));
            console.log();
        }
    }

    // 2. Provisioned Child Keys via Management Key
    if (mgtKey) {
        try {
            const openrouter = new OpenRouter({ apiKey: mgtKey });
            const keys = await openrouter.apiKeys.list();
            const list = (keys.data as any[]) || [];

            if (list.length > 0) {
                console.log(CYAN.bold(`  🔑 Provisioned Sub-Keys (${list.length}):\n`));
                list.forEach((key: any, i: number) => {
                    const num = String(i + 1).padStart(2, "0");
                    console.log(PURPLE("  ┌─────────────────────────────────────────────────────────────"));
                    console.log(PURPLE("  │ ") + CYAN.bold(`Sub-Key #${num}`) + DIM(`  ${key.hash ?? "N/A"}`));
                    console.log(PURPLE("  │ ") + BOLD("Name         ") + (key.name ?? "—"));
                    console.log(PURPLE("  │ ") + BOLD("Usage        ") + chalk.bold.white(formatMoney(key.usage)));
                    console.log(PURPLE("  └─────────────────────────────────────────────────────────────"));
                });
                console.log();
            } else {
                console.log(DIM("  ℹ  No child API keys provisioned under management key."));
            }
        } catch {
            // Ignore if management key has no sub-key permission
        }
    }

    console.log();
}