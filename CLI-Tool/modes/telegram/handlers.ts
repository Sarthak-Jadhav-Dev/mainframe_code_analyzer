import type { Telegraf } from "telegraf";
import fs from "node:fs";
import path from "node:path";
import { isOwner } from "./auth";
import { WELCOME } from "./constants";
import { commandArg } from "./text";
import { runAsk } from "./agent-run";
import { listApiKeys } from "./runstatestelegram";
import { runMainframeAudit } from "./mainframe-telegram";

interface PendingAuditState {
  step: "awaiting_audit_path";
  timestamp: number;
}

const pendingState = new Map<number, PendingAuditState>();
const lastUsedPaths = new Map<number, string>();

function validateAndResolvePath(rawInput: string): { valid: boolean; resolvedPath: string; error?: string } {
  const clean = rawInput.trim().replace(/^["']|["']$/g, "").trim();
  if (!clean) {
    return { valid: false, resolvedPath: "", error: "Path cannot be empty." };
  }

  const resolved = path.resolve(process.cwd(), clean);
  if (!fs.existsSync(resolved)) {
    return { valid: false, resolvedPath: resolved, error: `Directory does not exist:\n<code>${resolved}</code>` };
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return { valid: false, resolvedPath: resolved, error: `Specified path is a file, not a directory:\n<code>${resolved}</code>` };
  }

  return { valid: true, resolvedPath: resolved };
}

async function startAudit(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  targetPath: string,
  chatId: number
) {
  pendingState.delete(chatId);
  lastUsedPaths.set(chatId, targetPath);

  await ctx.reply(
    `🖥️ Starting Mainframe Codebase Audit\n\n<b>Repo:</b> <code>${targetPath}</code>`,
    { parse_mode: "HTML" }
  );
  void runMainframeAudit(ctx, targetPath).catch(console.error);
}

async function promptForDirectory(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number
) {
  pendingState.set(chatId, {
    step: "awaiting_audit_path",
    timestamp: Date.now(),
  });

  const cwd = process.cwd();
  const parent = path.resolve(cwd, "..");
  const lastPath = lastUsedPaths.get(chatId);

  const cwdLabel = path.basename(cwd) || cwd;
  const parentLabel = path.basename(parent) || parent;

  const inlineKeyboard: Array<Array<{ text: string; callback_data: string }>> = [
    [
      { text: `📁 Current: ${cwdLabel}`, callback_data: "audit_dir_cwd" },
      { text: `📁 Parent: ${parentLabel}`, callback_data: "audit_dir_parent" },
    ],
  ];

  if (lastPath && lastPath !== cwd && lastPath !== parent) {
    const lastLabel = path.basename(lastPath) || lastPath;
    inlineKeyboard.push([
      { text: `🔄 Last Used: ${lastLabel}`, callback_data: "audit_dir_last" },
    ]);
  }

  inlineKeyboard.push([
    { text: "❌ Cancel", callback_data: "audit_cancel" },
  ]);

  await ctx.reply(
    [
      `📁 <b>Mainframe Codebase Audit — Choose Directory</b>`,
      ``,
      `Please <b>send the directory path</b> you want to audit:`,
      `• Type an absolute path (e.g. <code>D:\\Projects_Extended\\Mainframe-Mega-Project</code>)`,
      `• Type <code>.</code> for the current workspace`,
      `• Type <code>..</code> for the parent directory`,
      ``,
      `Or tap one of the quick options below:`,
    ].join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    }
  );
}

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
    const arg = commandArg(ctx.message.text, "audit");

    if (arg) {
      const res = validateAndResolvePath(arg);
      if (!res.valid) {
        await ctx.reply(
          `❌ <b>Invalid directory provided:</b>\n${res.error}\n\nPlease enter a valid path:`,
          { parse_mode: "HTML" }
        );
        await promptForDirectory(ctx, ctx.chat.id);
        return;
      }
      await startAudit(ctx, res.resolvedPath, ctx.chat.id);
      return;
    }

    // No argument supplied -> prompt user to choose or type a directory
    await promptForDirectory(ctx, ctx.chat.id);
  });

  bot.command(["dir", "pwd"], async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const last = lastUsedPaths.get(ctx.chat.id) || process.cwd();
    await ctx.reply(
      `📂 <b>Target Directory Info</b>\n\n• <b>Current CWD:</b> <code>${process.cwd()}</code>\n• <b>Last Used:</b> <code>${last}</code>\n\nRun /audit to choose or enter a directory.`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("cancel", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    if (pendingState.has(ctx.chat.id)) {
      pendingState.delete(ctx.chat.id);
      await ctx.reply("❌ Active input prompt cancelled.");
    } else {
      await ctx.reply("ℹ️ No active prompt to cancel.");
    }
  });

  bot.action("audit_dir_cwd", async (ctx) => {
    if (!ctx.chat || !isOwner(ctx.chat.id)) return;
    await ctx.answerCbQuery().catch(() => {});
    await startAudit(ctx, process.cwd(), ctx.chat.id);
  });

  bot.action("audit_dir_parent", async (ctx) => {
    if (!ctx.chat || !isOwner(ctx.chat.id)) return;
    await ctx.answerCbQuery().catch(() => {});
    const parentPath = path.resolve(process.cwd(), "..");
    await startAudit(ctx, parentPath, ctx.chat.id);
  });

  bot.action("audit_dir_last", async (ctx) => {
    if (!ctx.chat || !isOwner(ctx.chat.id)) return;
    await ctx.answerCbQuery().catch(() => {});
    const target = lastUsedPaths.get(ctx.chat.id) || process.cwd();
    await startAudit(ctx, target, ctx.chat.id);
  });

  bot.action("audit_cancel", async (ctx) => {
    if (!ctx.chat || !isOwner(ctx.chat.id)) return;
    pendingState.delete(ctx.chat.id);
    await ctx.answerCbQuery("Audit cancelled").catch(() => {});
    await ctx.reply("❌ Audit cancelled.");
  });

  bot.on("text", async (ctx, next) => {
    if (!isOwner(ctx.chat.id)) return;
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) {
      return next();
    }

    const pending = pendingState.get(ctx.chat.id);
    if (pending && pending.step === "awaiting_audit_path") {
      const res = validateAndResolvePath(text);
      if (!res.valid) {
        await ctx.reply(
          `❌ <b>Invalid directory:</b>\n${res.error}\n\nPlease enter a valid path, or /cancel to abort.`,
          { parse_mode: "HTML" }
        );
        return;
      }
      await startAudit(ctx, res.resolvedPath, ctx.chat.id);
      return;
    }

    return next();
  });
}