import chalk from "chalk";
import { select, text, isCancel } from "@clack/prompts";
import { z } from "zod";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { getAgentModel } from "../../ai";
import { defaultAgentConfig } from "../agents/types";
import { actionTracker } from "../agents/action_tracker";
import { ToolExecutor } from "../agents/tool-executor";
import { renderTerminalMarkdown } from "../../terminal_ui/terminal_md";
import { runApprovalFlow } from "../agents/approval";
import {createWebTools} from "../plan/web-tools";

function createAskTool(executor: ToolExecutor) {
    return {
        read_file: tool({
            description: "Read the content of a file. The path is relative to the codebase root.",
            inputSchema: z.object({
                path: z.string().describe("The relative path to the file"),
            }),
            execute: async ({ path: p }) => executor.readFile(p),

        }),
        list_files: tool({
            description: "List files and directories under a path.",
            inputSchema: z.object({
                path: z.string(),
                recursive: z.boolean().optional().default(false),
            }),
            execute: async ({ path: p, recursive }) => executor.listFiles(p, recursive),
        }),
        search_files: tool({
            description:
                'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
            inputSchema: z.object({
                root: z.string().describe("Directory to search, relative to root"),
                pattern: z
                    .string()
                    .describe("Glob-like pattern using * and ** (forward slashes)"),
                content_contains: z.string().optional(),
            }),
            execute: async ({ root, pattern, content_contains }) => executor.searchFiles(root, pattern, content_contains),
        }),
        list_skills: tool({
            description:
                "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
            inputSchema: z.object({}),
            execute: async () => executor.listSkills(),
        }),
        read_skill: tool({
            description:
                "Read a SKILL.md file. Path must be absolute and under skill roots, or use a path returned by list_skills.",
            inputSchema: z.object({
                path: z.string(),
            }),
            execute: async ({ path: p }) => executor.readSkill(p),
        }),
        analyze_codebase: tool({
            description:
                "Summarize structure: file counts, size, extensions. Read-only.",
            inputSchema: z.object({
                path: z.string().default("."),
            }),
            execute: async ({ path: p }) => executor.analyzeCodebase(p),
        }),
    }
}

function asMd(question: string, answer: string): string {
    return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
}

export async function runAskMode() {
    console.log(chalk.bold("\nAsk Mode is Running\n"));

    const goal = await text({
        message: "What would you like to know about the codebase?",
        placeholder: "Ask a question about this codebase…",
    });

    if (goal === null || isCancel(goal)) return;
    const config = defaultAgentConfig();
    config.tools.allowFileModification = false;
    config.tools.allowShellExecution = false;
    config.tools.allowFolderCreation = false;
    config.tools.allowFileCreation = true;

    const tracker = new actionTracker();
    const executor = new ToolExecutor(tracker, config);
    const tools = {
        ...createAskTool(executor),
        ...createWebTools(tracker),
    };

    const agent = new ToolLoopAgent({
        model: await getAgentModel(),
        stopWhen: stepCountIs(10),
        tools,
    })

    const result = await agent.generate({
        prompt: goal.trim(),
    })
    const answer = result.text?.trim();
    console.log(chalk.bold("\nAnswer:\n"));
    console.log(renderTerminalMarkdown(answer || "No answer generated."));

    const wantsToSave = await select({
        message: "Do you want to save this answer for future reference?",
        initialValue: "false",
        options: [
            { value: "yes", label: "Yes, save it" },
            { value: "no", label: "No, discard it" },
        ]
    })
    if(wantsToSave === "no"){
        console.log(chalk.yellow("Not saving the answer."));
        return;
    }
    if (isCancel(wantsToSave)) {
        return
    };
    const filename = await text({
        message: "Filename",
        initialValue: "ask.md",
        validate: (v) => {
            const s = (v ?? '').trim();
            if (!s) return 'Required';
            if (s.includes('..') || s.includes('/') || s.includes('\\')) return 'No paths';
            if (!s.toLowerCase().endsWith('.md')) return 'Must end with .md';
        },
    })
    if (isCancel(filename) || !filename) {
        console.log(chalk.yellow("Not saving the answer."));
        return;
    }
    executor.createFile(filename, asMd(goal, answer));
    const ok = await runApprovalFlow(tracker);
    if (!ok) return executor.clearStaging();

    executor.applyApprovedFromTracker();
    executor.clearStaging();
}