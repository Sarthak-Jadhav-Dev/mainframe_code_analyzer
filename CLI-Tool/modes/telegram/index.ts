import { Telegraf } from "telegraf";
import chalk from "chalk";
import { WELCOME } from "./constants.ts";
import { registerHandlers } from "./handlers.ts";

export async function runTelegramMode() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const ownerId = process.env.TELEGRAM_OWNER_ID;

    if (!botToken || !ownerId) {
        console.log(chalk.red("TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_ID environment variables are required to run in Telegram mode."));
        return;
    }
    const bot = new Telegraf(botToken);
    registerHandlers(bot);
    await bot.telegram.sendMessage(ownerId, WELCOME, { parse_mode: "Markdown" });
    console.log(chalk.green("\nTelegram Mode is Running\n"));
    bot.launch();
    console.log(chalk.green("Bot launched. Waiting for messages..."));
    await new Promise<void>((resolve) => {
        const stop = () => {
            bot.stop("SIGINT");
            resolve();
        };
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
    });
}