/**
 * Mainframe Codebase Auditor — AI Project Partitioner
 * ----------------------------------------------------
 * Analyzes the repository directory structure using AI to logically
 * break the codebase into architectural components (e.g., Frontend UI,
 * Backend API, Database, Utilities, etc.) and allows the user to
 * selectively audit only a specific portion of the project.
 */

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { select, text, spinner, isCancel } from "@clack/prompts";
import { generateText } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";

export interface ProjectPartition {
    id: string;
    label: string;
    description: string;
    paths: string[];
}

export interface ScopeSelectionResult {
    scopeLabel: string;
    targetPaths?: string[]; // undefined means full repository
    isScoped: boolean;
}

const SKIP_DIRS = new Set([
    "node_modules", ".git", "dist", "build", ".next",
    ".nuxt", ".svelte-kit", "out", "coverage", ".turbo",
    ".cache", "__pycache__", ".venv", "venv", "env",
    "target", ".gradle", ".mvn", "bin", "obj",
]);

/**
 * Scan directory structure up to depth 3 to build an architectural overview
 * for the AI model.
 */
export function getProjectStructureSummary(repoPath: string): { summary: string; topDirs: string[] } {
    const abs = path.resolve(repoPath);
    const topDirs: string[] = [];
    const treeLines: string[] = [];

    // Identify configuration files that signal the project stack
    const configFiles = [
        "package.json", "tsconfig.json", "requirements.txt",
        "pyproject.toml", "pom.xml", "build.gradle", "Cargo.toml",
        "go.mod", "docker-compose.yml", "Dockerfile"
    ];
    const detectedConfigs: string[] = [];
    for (const cfg of configFiles) {
        if (fs.existsSync(path.join(abs, cfg))) detectedConfigs.push(cfg);
    }

    try {
        const rootEntries = fs.readdirSync(abs, { withFileTypes: true });
        for (const ent of rootEntries) {
            if (SKIP_DIRS.has(ent.name) || ent.name.startsWith(".")) continue;

            if (ent.isDirectory()) {
                topDirs.push(ent.name);
                treeLines.push(`📁 ${ent.name}/`);

                // Level 2
                const dirL2 = path.join(abs, ent.name);
                try {
                    const l2Entries = fs.readdirSync(dirL2, { withFileTypes: true });
                    for (const l2 of l2Entries.slice(0, 12)) {
                        if (SKIP_DIRS.has(l2.name) || l2.name.startsWith(".")) continue;
                        if (l2.isDirectory()) {
                            treeLines.push(`   📁 ${ent.name}/${l2.name}/`);
                            // Level 3 (for src/ or nested modules)
                            if (["src", "app", "lib", "packages"].includes(ent.name.toLowerCase())) {
                                try {
                                    const l3Entries = fs.readdirSync(path.join(dirL2, l2.name), { withFileTypes: true });
                                    for (const l3 of l3Entries.slice(0, 6)) {
                                        if (SKIP_DIRS.has(l3.name) || l3.name.startsWith(".")) continue;
                                        treeLines.push(`      ${l3.isDirectory() ? "📁" : "📄"} ${ent.name}/${l2.name}/${l3.name}`);
                                    }
                                    if (l3Entries.length > 6) {
                                        treeLines.push(`      ... (${l3Entries.length - 6} more items)`);
                                    }
                                } catch {}
                            }
                        } else {
                            treeLines.push(`   📄 ${ent.name}/${l2.name}`);
                        }
                    }
                    if (l2Entries.length > 12) {
                        treeLines.push(`   ... (${l2Entries.length - 12} more items)`);
                    }
                } catch {}
            } else {
                treeLines.push(`📄 ${ent.name}`);
            }
        }
    } catch {}

    const summary = [
        detectedConfigs.length > 0 ? `Configuration Markers: ${detectedConfigs.join(", ")}` : "",
        `Top Directories: ${topDirs.join(", ")}`,
        `Repository Tree Overview:`,
        ...treeLines.slice(0, 60),
    ].filter(Boolean).join("\n");

    return { summary, topDirs };
}

/**
 * Heuristic fallback partitioning if AI is unavailable or produces unparseable output.
 */
function buildHeuristicPartitions(repoPath: string, topDirs: string[]): ProjectPartition[] {
    const abs = path.resolve(repoPath);
    const partitions: ProjectPartition[] = [];

    // Check if there is a src folder with distinct subfolders
    const srcPath = path.join(abs, "src");
    if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
        try {
            const srcEntries = fs.readdirSync(srcPath, { withFileTypes: true });
            const subdirs = srcEntries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));

            for (const d of subdirs.slice(0, 5)) {
                const name = d.name.toLowerCase();
                let icon = "📁";
                let desc = `Files inside src/${d.name}`;

                if (name.includes("comp") || name.includes("ui")) {
                    icon = "🎨";
                    desc = "UI Components and visual presentation elements";
                } else if (name.includes("page") || name.includes("view") || name.includes("route")) {
                    icon = "📄";
                    desc = "Application pages, views, and routing logic";
                } else if (name.includes("server") || name.includes("api")) {
                    icon = "⚡";
                    desc = "Backend API endpoints and server handlers";
                } else if (name.includes("db") || name.includes("model") || name.includes("schema")) {
                    icon = "💾";
                    desc = "Database clients, models, and schemas";
                } else if (name.includes("util") || name.includes("help") || name.includes("lib")) {
                    icon = "🛠️";
                    desc = "Helper functions, shared utilities, and libraries";
                } else if (name.includes("hook") || name.includes("state") || name.includes("store")) {
                    icon = "🔄";
                    desc = "State management, custom hooks, and stores";
                }

                partitions.push({
                    id: `src-${d.name}`,
                    label: `${icon} src/${d.name}`,
                    description: desc,
                    paths: [`src/${d.name}`],
                });
            }
        } catch {}
    }

    // Also include other top-level directories
    for (const dir of topDirs) {
        if (dir.toLowerCase() === "src") continue;
        if (partitions.length >= 6) break;

        const name = dir.toLowerCase();
        let icon = "📁";
        let desc = `All files inside ${dir}/`;

        if (name.includes("doc")) {
            icon = "📚";
            desc = "Documentation and project guides";
        } else if (name.includes("test")) {
            icon = "🧪";
            desc = "Test suites and specifications";
        } else if (name.includes("cli") || name.includes("tool")) {
            icon = "💻";
            desc = "CLI utilities and tooling";
        } else if (name.includes("main") || name.includes("program")) {
            icon = "🏛️";
            desc = "Mainframe programs and batch scripts";
        }

        partitions.push({
            id: `top-${dir}`,
            label: `${icon} ${dir}/`,
            description: desc,
            paths: [dir],
        });
    }

    return partitions;
}

/**
 * Use AI to logically partition the project structure into meaningful modules.
 */
export async function discoverProjectPartitions(repoPath: string): Promise<ProjectPartition[]> {
    const { summary, topDirs } = getProjectStructureSummary(repoPath);

    try {
        const model = await getAgentModel();
        const prompt = [
            "You are an expert Software Architect.",
            "Analyze the project directory structure below and divide the repository into 2 to 5 meaningful, cohesive architectural components/modules that a developer might want to audit individually.",
            "Examples: Frontend UI Components, Backend Services & API, Database & Schemas, Shared Utilities, CLI/Tooling.",
            "",
            "Project Directory Structure:",
            summary,
            "",
            "Rules:",
            "1. Group related directories/files into sensible modules based ONLY on the directories that actually exist in the structure above.",
            "2. 'paths' must be an array of relative paths (e.g. ['src/components', 'src/views'] or ['backend']).",
            "3. Do NOT include 'node_modules', '.git', 'dist', or build folders.",
            "4. Output ONLY a valid JSON array of objects, with NO surrounding explanation or markdown fence blocks:",
            `[
  {
    "id": "frontend-ui",
    "label": "🎨 Frontend UI & Components",
    "description": "User interface, components, and views",
    "paths": ["src/components"]
  }
]`,
        ].join("\n");

        const result = await generateText({
            model,
            prompt,
            maxOutputTokens: 1500,
        });

        const text = result.text?.trim() || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as ProjectPartition[];
            const validPartitions: ProjectPartition[] = [];
            const abs = path.resolve(repoPath);

            for (const p of parsed) {
                if (p.id && p.label && Array.isArray(p.paths) && p.paths.length > 0) {
                    // Check that at least one path actually exists
                    const existingPaths = p.paths.filter((pth) => fs.existsSync(path.resolve(abs, pth)));
                    if (existingPaths.length > 0) {
                        validPartitions.push({
                            id: p.id,
                            label: p.label,
                            description: p.description || `Module: ${existingPaths.join(", ")}`,
                            paths: existingPaths,
                        });
                    }
                }
            }

            if (validPartitions.length >= 2) {
                return validPartitions;
            }
        }
    } catch {
        // Fall back gracefully to heuristic partitions
    }

    return buildHeuristicPartitions(repoPath, topDirs);
}

/**
 * Interactive prompt asking the user which portion of the codebase they wish to audit.
 */
export async function promptUserForAuditScope(repoPath: string): Promise<ScopeSelectionResult | null> {
    const abs = path.resolve(repoPath);

    const s = spinner();
    s.start("AI analyzing repository structure & logical partitions…");
    const partitions = await discoverProjectPartitions(repoPath);
    s.stop("Repository structure analyzed.");

    const options = [
        {
            value: "ALL",
            label: "🌐 Entire Project — Scan all files in the repository",
        },
        ...partitions.map((p) => ({
            value: p.id,
            label: `${p.label} — ${p.description} (${p.paths.join(", ")})`,
        })),
        {
            value: "CUSTOM",
            label: "📁 Custom Path — Enter a specific folder or file manually",
        },
    ];

    console.log();
    const chosenValue = await select({
        message: chalk.hex("#00d4ff").bold("Which portion of the project do you want to audit?"),
        options,
    });

    if (isCancel(chosenValue)) {
        return null;
    }

    if (chosenValue === "ALL") {
        return {
            scopeLabel: "Entire Project",
            targetPaths: undefined,
            isScoped: false,
        };
    }

    if (chosenValue === "CUSTOM") {
        const customInput = await text({
            message: "Relative path to folder or file to audit:",
            placeholder: "e.g. src/components or src/server.ts",
            validate: (val) => {
                const cleaned = (val || "").trim().replace(/^["']|["']$/g, "");
                if (!cleaned) return "Path cannot be empty.";
                const target = path.resolve(abs, cleaned);
                if (!fs.existsSync(target)) return `Path does not exist in repository: ${cleaned}`;
            },
        });

        if (isCancel(customInput) || !customInput) {
            return null;
        }

        const cleaned = (customInput as string).trim().replace(/^["']|["']$/g, "");
        return {
            scopeLabel: `Custom (${cleaned})`,
            targetPaths: [cleaned],
            isScoped: true,
        };
    }

    // Selected one of the AI partitions
    const selectedPartition = partitions.find((p) => p.id === chosenValue);
    if (!selectedPartition) {
        return {
            scopeLabel: "Entire Project",
            targetPaths: undefined,
            isScoped: false,
        };
    }

    return {
        scopeLabel: selectedPartition.label,
        targetPaths: selectedPartition.paths,
        isScoped: true,
    };
}
