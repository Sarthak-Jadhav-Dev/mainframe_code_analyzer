import chalk from "chalk";
import { select, isCancel, spinner } from "@clack/prompts";
import { listApiKeys } from "./handler";

const CYAN   = chalk.hex("#00d4ff");
const PURPLE = chalk.hex("#a855f7");

export async function runStateModes() {
    console.log();
    console.log(PURPLE.bold("  ╔════════════════════════════════════════════════════════════╗"));
    console.log(PURPLE.bold("  ║  ") + CYAN.bold("STATS — OpenRouter Key & Usage Analytics") + PURPLE.bold("         ║"));
    console.log(PURPLE.bold("  ╚════════════════════════════════════════════════════════════╝"));
    console.log();

    const selectMode = await select({
        message: chalk.hex("#ffffcc").bold("What would you like to do?"),
        options: [
            { value: "list", label: "🔑 Account & API Key Stats  — usage, limits & credits" },
            { value: "back", label: "← Back" },
        ],
    });

    if (isCancel(selectMode) || selectMode === "back") {
        console.log(chalk.dim("Going back…"));
        return;
    }

    if (selectMode === "list") {
        const s = spinner();
        s.start("Connecting to OpenRouter…");
        try {
            s.stop("Connected.");
            await listApiKeys();
        } catch (err) {
            s.stop("Failed.");
            console.log(
                chalk.hex("#f87171")("  ✗ Error: ") +
                (err instanceof Error ? err.message : String(err))
            );
        }
    }
}
