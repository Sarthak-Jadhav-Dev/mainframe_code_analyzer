import chalk from "chalk";
import { select, isCancel } from "@clack/prompts"
import { runAskMode } from "./ask/orcharstrator";
import { runStateModes } from "./stats/orcharstrator";
import { runMainframeMode } from "./mainframe/orcharstrator";
import { ICONS } from "../terminal_ui/icons";

export async function runCliMode() {
    while (true) {
        const mode = await select({
            message: chalk.hex("#ffffcc").bold("What do you want to do?"),
            options: [
                { value: "Ask",       label: `${ICONS.search} Ask       ${ICONS.dash} read-only Q&A about codebase` },
                { value: "Stats",     label: `${ICONS.stats} Stats     ${ICONS.dash} OpenRouter API key usage` },
                { value: "Mainframe", label: `${ICONS.mainframe} Mainframe ${ICONS.dash} codebase audit via Hercules TK5` },
                { value: "Exit",      label: `${ICONS.exit} Exit` }
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