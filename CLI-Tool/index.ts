#!/usr/bin/env bun

import { Command } from "commander";
import { runWakeup } from "./terminal_ui/wakeup";

const program = new Command();

program
    .name("inspectra")
    .description("Inspectra - AI-powered agent")
    .version("0.0.1");

program
    .command("wakeup")
    .description("The starting logic of the app")
    .action(
        async () => {
            await runWakeup();
        }
    )

await program.parseAsync(process.argv);