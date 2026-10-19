import chalk from "chalk";
import { select, isCancel } from "@clack/prompts"
import { runAskMode } from "./ask/orcharstrator";
import {runStateModes} from "./stats/orcharstrator";
import {runMainframeMode} from "./mainframe/orcharstrator";

export async function runCliMode() {
    while (true) {
        const mode = await select({
            message: chalk.hex("#ffffcc").bold("What do you want to do?"),
            options: [
                { value: "Ask",       label: "🔍 Ask       — read-only Q&A about codebase" },
                { value: "Stats",     label: "📊 Stats     — OpenRouter API key usage" },
                { value: "Mainframe", label: "🖥️  Mainframe — codebase audit via Hercules TK5" },
                { value: "Exit",      label: "🚪 Exit" }
            ]
        })
        if (isCancel(mode) || mode === "Exit") {
            console.log(chalk.dim("Coming Back..."));
            return;
        }
        if (mode === "Ask") { 
            await runAskMode();
        }
        if (mode === "Stats"){
            await runStateModes();
        }
        if (mode === "Mainframe") {
            await runMainframeMode();
        }
    }
}