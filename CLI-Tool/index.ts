#!/usr/bin/env bun

// 1. Ensure Windows Console environment is UTF-8 and Unicode-ready BEFORE any UI packages are loaded
if (process.platform === "win32") {
    if (!process.env.TERM) {
        process.env.TERM = "xterm-256color";
    }
    try {
        const { dlopen, FFIType } = await import("bun:ffi");
        const kernel32 = dlopen("kernel32.dll", {
            SetConsoleOutputCP: { args: [FFIType.u32], returns: FFIType.bool },
            SetConsoleCP: { args: [FFIType.u32], returns: FFIType.bool },
        });
        kernel32.symbols.SetConsoleOutputCP(65001);
        kernel32.symbols.SetConsoleCP(65001);
    } catch {
        try {
            const { execSync } = await import("node:child_process");
            execSync("chcp 65001", { stdio: "ignore" });
        } catch {}
    }
}

import { Command } from "commander";

const program = new Command();

program
    .name("inspectra")
    .description("Inspectra - AI-powered agent")
    .version("0.0.1");

program
    .command("wakeup")
    .description("The starting logic of the app")
    .action(async () => {
        const { runWakeup } = await import("./terminal_ui/wakeup");
        await runWakeup();
    });

await program.parseAsync(process.argv);