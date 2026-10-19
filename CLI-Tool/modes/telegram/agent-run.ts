import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai/ai.config.ts";
import { replyMd } from "./text.ts";
import fs from "node:fs";
import path from "node:path";

/** Recursively walk a directory and return all file paths (relative to root). */
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

// ─── Read-only tools for /ask ─────────────────────────────────────────────────

function createReadOnlyTools(codebasePath: string) {
    return {
        read_file: tool({
            description: "Read a workspace file. Path is relative to the codebase root.",
            inputSchema: z.object({ path: z.string() }),
            execute: async ({ path: p }) => {
                try {
                    return fs.readFileSync(path.resolve(codebasePath, p), "utf-8");
                } catch (e) {
                    return `Error: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
        list_files: tool({
            description: "List files/dirs at a path.",
            inputSchema: z.object({
                path: z.string(),
                recursive: z.boolean().optional().default(false),
            }),
            execute: async ({ path: p, recursive }) => {
                try {
                    const abs = path.resolve(codebasePath, p);
                    if (recursive) {
                        return walkDir(abs).join("\n");
                    }
                    return fs.readdirSync(abs).join("\n");
                } catch (e) {
                    return `Error: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
        search_files: tool({
            description: "Find files matching a glob pattern; optional content filter.",
            inputSchema: z.object({
                root: z.string(),
                pattern: z.string(),
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
                    return files
                        .filter((f: string) => {
                            try {
                                return fs.readFileSync(path.join(abs, f), "utf-8").includes(content_contains);
                            } catch {
                                return false;
                            }
                        })
                        .join("\n");
                } catch (e) {
                    return `Error: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
        analyze_codebase: tool({
            description: "Summarize the codebase structure (file counts, extensions, size).",
            inputSchema: z.object({ path: z.string().default(".") }),
            execute: async ({ path: p }) => {
                try {
                    const abs = path.resolve(codebasePath, p);
                    const all = walkDir(abs);
                    const extMap: Record<string, number> = {};
                    let totalSize = 0;
                    for (const f of all) {
                        const ext = path.extname(f) || "(no ext)";
                        extMap[ext] = (extMap[ext] || 0) + 1;
                        try { totalSize += fs.statSync(path.join(abs, f)).size; } catch {}
                    }
                    const breakdown = Object.entries(extMap)
                        .sort(([, a], [, b]) => b - a)
                        .map(([ext, count]) => `  ${ext.padEnd(12)} ${count} files`)
                        .join("\n");
                    return [`Root: ${abs}`, `Total files: ${all.length}`, `Total size: ${(totalSize / 1024).toFixed(1)} KB`, "", breakdown].join("\n");
                } catch (e) {
                    return `Error: ${e instanceof Error ? e.message : String(e)}`;
                }
            },
        }),
    };
}

// ─── /ask handler ─────────────────────────────────────────────────────────────

export async function runAsk(
    ctx: { reply: (t: string, o?: object) => Promise<unknown> },
    question: string,
) {
    const codebasePath = process.cwd();
    const tools = createReadOnlyTools(codebasePath);

    const agent = new ToolLoopAgent({
        model: await getAgentModel(),
        stopWhen: stepCountIs(20),
        instructions: `Workspace root: ${codebasePath}. Read-only — do not suggest edits.`,
        tools,
    });

    const { text } = await agent.generate({ prompt: question });
    await replyMd(ctx, text || "No answer generated.");
}