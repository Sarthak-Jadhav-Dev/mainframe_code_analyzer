import type { Telegraf } from "telegraf";
import { isOwner } from "./auth";
import { WELCOME } from "./constants";
import { commandArg } from "./text";
import { runAsk } from "./agent-run";
import { runStateModes } from "../stats/orcharstrator";
import { listApiKeys } from "./runstatestelegram";
import { runMainframeAudit } from "./mainframe-telegram";

export function registerHandlers(bot: Telegraf) {
  bot.command("start", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    await ctx.reply(WELCOME, { parse_mode: "Markdown" });
  });

  bot.command("ask", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const q = commandArg(ctx.message.text, "ask");
    if (!q)
      return ctx.reply("Usage: `/ask <your question>`", {
        parse_mode: "Markdown",
      });

    await ctx.reply("🔍 Researching your question…");
    void runAsk(ctx, q).catch(console.error);
  });

  bot.command("stats", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    await ctx.reply("API-Key Usage Data is Being Fetched", { parse_mode: "Markdown" });
    void listApiKeys(ctx).catch(console.error);
  });

  bot.command("audit", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const repoPath = commandArg(ctx.message.text, "audit") || process.cwd();
    await ctx.reply(
      `🖥️ Starting Mainframe Codebase Audit\n\n<b>Repo:</b> <code>${repoPath}</code>`,
      { parse_mode: "HTML" }
    );
    void runMainframeAudit(ctx, repoPath).catch(console.error);
  });
}