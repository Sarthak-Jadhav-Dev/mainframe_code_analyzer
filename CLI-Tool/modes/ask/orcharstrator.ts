import chalk from "chalk";
import { select, text, isCancel, spinner } from "@clack/prompts";
import { z } from "zod";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkdown } from "../../terminal_ui/terminal_md";
import fs from "node:fs";
import path from "node:path";

function walkDir(root: string): string[] {
    const results: string[] = [];
    const visit = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) visit(full);
            else results.push(path.relative(root, full));
        }
    };
    visit(root);
    return results;
}

function createAskTools(codebasePath: string) {
    return {
        read_file: tool({
            description: "Read the content of a file. Path is relative to the codebase root.",
            inputSchema: z.object({
                path: z.string().describe("Relative path to the file"),
            }),
            execute: async ({ path: p }) => {
                try {
                    const abs = path.resolve(codebasePath, p);
                    return fs.readFileSync(abs, "utf-8");
                } catch (e) {
                    return `Error reading file: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
        list_files: tool({
            description: "List files and directories under a path.",
            inputSchema: z.object({
                path: z.string().describe("Relative directory path"),
                recursive: z.boolean().optional().default(false),
            }),
            execute: async ({ path: p, recursive }) => {
                try {
                    const abs = path.resolve(codebasePath, p);
                    if (recursive) {
                        const entries = fs.readdirSync(abs, { recursive: true, withFileTypes: true });
                        return (entries as fs.Dirent[]).map((e) => e.name).join("\n");
                    }
                    return fs.readdirSync(abs).join("\n");
                } catch (e) {
                    return `Error listing files: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
        search_files: tool({
            description: "Find files matching a glob pattern. Optional content substring filter.",
            inputSchema: z.object({
                root: z.string().describe("Directory to search, relative to codebase root"),
                pattern: z.string().describe("Glob pattern e.g. '**/*.ts'"),
                content_contains: z.string().optional(),
            }),
            execute: async ({ root, pattern, content_contains }) => {
                try {
                    const abs = path.resolve(codebasePath, root);
                    const allFiles = walkDir(abs);
                    // Simple glob-like pattern match: convert * and ** to regex
                    const regexStr = pattern
                        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                        .replace(/\*\*/g, "__GLOBSTAR__")
                        .replace(/\*/g, "[^/\\\\]*")
                        .replace(/__GLOBSTAR__/g, ".*");
                    const re = new RegExp(`^${regexStr}$`, "i");
                    const files = allFiles.filter((f: string) => re.test(f.replace(/\\/g, "/")));
                    if (!content_contains) return files.join("\n");
                    const matched = files.filter((f: string) => {
                        try {
                            return fs.readFileSync(path.join(abs, f), "utf-8").includes(content_contains);
                        } catch {
                            return false;
                        }
                    });
                    return matched.join("\n");
                } catch (e) {
                    return `Error searching files: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
        analyze_codebase: tool({
            description: "Summarize structure: file counts, size, extensions. Read-only.",
            inputSchema: z.object({
                path: z.string().default("."),
            }),
            execute: async ({ path: p }) => {
                try {
                    const abs = path.resolve(codebasePath, p);
                    const all = walkDir(abs);
                    const extMap: Record<string, number> = {};
                    let totalSize = 0;
                    for (const f of all) {
                        const ext = path.extname(f) || "(no ext)";
                        extMap[ext] = (extMap[ext] || 0) + 1;
                        try {
                            totalSize += fs.statSync(path.join(abs, f)).size;
                        } catch {}
                    }
                    const breakdown = Object.entries(extMap)
                        .sort(([, a], [, b]) => b - a)
                        .map(([ext, count]) => `  ${ext.padEnd(12)} ${count} files`)
                        .join("\n");
                    return [
                        `Root: ${abs}`,
                        `Total files: ${all.length}`,
                        `Total size : ${(totalSize / 1024).toFixed(1)} KB`,
                        "",
                        "Extension breakdown:",
                        breakdown,
                    ].join("\n");
                } catch (e) {
                    return `Error analyzing: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
    };
}

function asMd(question: string, answer: string): string {
    return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
}


export async function runAskMode() {
    console.log(chalk.bold("\nAsk Mode is Running\n"));

    const dirInput = await text({
        message: "Directory to ask about:",
        placeholder: process.cwd(),
        initialValue: process.cwd(),
        validate: (v) => {
            const p = (v || "").trim() || process.cwd();
            const abs = path.resolve(p);
            if (!fs.existsSync(abs))  return `Path does not exist: ${abs}`;
            if (!fs.statSync(abs).isDirectory()) return `Not a directory: ${abs}`;
        },
    });

    if (isCancel(dirInput)) return;

    const codebasePath = path.resolve((dirInput as string).trim() || process.cwd());
    console.log(chalk.dim(`  Workspace: ${codebasePath}\n`));

    const goal = await text({
        message: "What would you like to know about this directory?",
        placeholder: "Ask a question about this codebase…",
    });

    if (goal === null || isCancel(goal)) return;

    const tools = createAskTools(codebasePath);

    const agent = new ToolLoopAgent({
        model: await getAgentModel(),
        stopWhen: stepCountIs(10),
        tools,
    });

    const s = spinner();
    s.start("Thinking…");

    const result = await agent.generate({
        prompt: goal.trim(),
        onStepFinish: ({ toolCalls }) => {
            if (toolCalls.length > 0) {
                const toolName = String(toolCalls[0]!.toolName);
                const label =
                    toolName === "read_file"       ? "Reading files…"    :
                    toolName === "list_files"      ? "Listing files…"    :
                    toolName === "search_files"    ? "Searching…"        :
                    toolName === "analyze_codebase"? "Analyzing codebase…" :
                    `Using ${toolName}…`;
                s.message(label);
            }
        },
    });

    s.stop("Done.");

    const answer = result.text?.trim();

    console.log(chalk.bold("\nAnswer:\n"));
    console.log(renderTerminalMarkdown(answer || "No answer generated."));

    const wantsToSave = await select({
        message: "Do you want to save this answer for future reference?",
        initialValue: "no",
        options: [
            { value: "yes", label: "Yes, save it" },
            { value: "no",  label: "No, discard it" },
        ],
    });

    if (isCancel(wantsToSave) || wantsToSave === "no") {
        console.log(chalk.yellow("Not saving the answer."));
        return;
    }

    const filename = await text({
        message: "Filename",
        initialValue: "ask.md",
        validate: (v) => {
            const s = (v ?? "").trim();
            if (!s) return "Required";
            if (s.includes("..") || s.includes("/") || s.includes("\\")) return "No paths";
            if (!s.toLowerCase().endsWith(".md")) return "Must end with .md";
        },
    });

    if (isCancel(filename) || !filename) {
        console.log(chalk.yellow("Not saving the answer."));
        return;
    }

    const savePath = path.resolve(codebasePath, filename as string);
    fs.writeFileSync(savePath, asMd(goal, answer ?? ""), "utf-8");
    console.log(chalk.green(`\n  ✓ Saved to ${savePath}\n`));
}