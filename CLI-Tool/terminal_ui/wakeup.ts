import { select, isCancel } from "@clack/prompts"
import chalk from "chalk"
import figlet from "figlet"
import { runCliMode } from "../modes/cli";
import { runTelegramMode } from "../modes/telegram";

const BANNERFONT = "ANSI SHADOW"
const SHADOW = chalk.hex("#a851e3ff");
const FACE = chalk.hex("#ba81e8ff").bold

function printBannerWithShadow(ascii: string) {


    const bannerLines = ascii.replace(/\s+$/, '').split('\n');
    const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
    const rowWidth = maxLen + 2;

    for (const line of bannerLines) {
        console.log(SHADOW(('  ' + line).padEnd(rowWidth)));
    }
    process.stdout.write(`\x1b[${bannerLines.length}A`);
    for (const line of bannerLines) {
        console.log(FACE(line.padEnd(rowWidth)));
    }
    console.log();
}

export async function runWakeup() {
    let ascii: string;
    try {
        ascii = await figlet.textSync("INSPECTRA", { font: BANNERFONT })
    } catch (error) {
        ascii = await figlet.textSync("INSPECTRA", { font: "standard" })
    }
    printBannerWithShadow(ascii);

    const mode = await select({
        message: "Select one mode to start with :",
        options: [
            { value: "cli", label: "CLI" },
            { value: "telegram", label: "Telegram" },
            { value: "exit", label: "Exit" }
        ]
    })

    if (isCancel(mode) || mode === "exit") {
        console.log(chalk.dim("\nGoodBye...\n"));
        return;
    }

    if (mode === "cli") {
        console.log(chalk.dim("Starting the CLI..."));
        await runCliMode();
    } else {
        console.log(chalk.dim("Telegram Bot Activated..."));
        await runTelegramMode();
    }
}