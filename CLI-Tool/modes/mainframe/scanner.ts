/**
 * Mainframe Codebase Auditor — Repository Scanner
 * -------------------------------------------------
 * Scans a local codebase, detects technology imports,
 * computes content hashes, and prepares records for the
 * fixed-width flat file that will be sent to Hercules.
 *
 * Technologies detected:
 *   - Frontend: React, Vue, Angular, Svelte, Next.js, Nuxt, SolidJS
 *   - Backend: Express, Fastify, NestJS, Koa, Hapi, Elysia
 *   - HTTP: Axios, Got, Node-Fetch, Ky, Superagent
 *   - Database: Prisma, Mongoose, TypeORM, Sequelize, Drizzle, Knex
 *   - Testing: Jest, Vitest, Mocha, Chai, Playwright, Cypress
 *   - Build: Vite, Webpack, Rollup, Parcel, Turbopack
 *   - State: Redux, Zustand, Jotai, Recoil, Pinia, MobX
 *   - Auth: Passport, NextAuth, Jose, Lucia, BetterAuth
 *   - Infra: Docker, K8s, AWS SDK, GCP, Azure
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { TechImport, ScannedFile, ScanResult, FlatFileRecord, UsageType } from "./types.ts";

// ─── Technology Detection Registry ───────────────────────────────────────────

interface TechPattern {
    name: string;
    category: string;
    /** Regex that matches import/require lines referencing this tech */
    pattern: RegExp;
}

const TECH_PATTERNS: TechPattern[] = [
    // Frontend frameworks
    { name: "REACT", category: "frontend-fw", pattern: /from\s+['"]react['"]/i },
    { name: "VUE", category: "frontend-fw", pattern: /from\s+['"]vue['"]/i },
    { name: "ANGULAR", category: "frontend-fw", pattern: /from\s+['"]@angular\//i },
    { name: "SVELTE", category: "frontend-fw", pattern: /from\s+['"]svelte['"]/i },
    { name: "SOLIDJS", category: "frontend-fw", pattern: /from\s+['"]solid-js['"]/i },
    // Meta-frameworks
    { name: "NEXTJS", category: "meta-fw", pattern: /from\s+['"]next(?:\/|['"])/i },
    { name: "NUXT", category: "meta-fw", pattern: /from\s+['"](?:#app|nuxt)['"]/i },
    { name: "REMIX", category: "meta-fw", pattern: /from\s+['"]@remix-run\//i },
    { name: "ASTRO", category: "meta-fw", pattern: /from\s+['"]astro['"]/i },
    // Backend frameworks
    { name: "EXPRESS", category: "backend", pattern: /require\(['"]express['"]\)|from\s+['"]express['"]/i },
    { name: "FASTIFY", category: "backend", pattern: /from\s+['"]fastify['"]/i },
    { name: "NESTJS", category: "backend", pattern: /from\s+['"]@nestjs\//i },
    { name: "KOA", category: "backend", pattern: /from\s+['"]koa['"]/i },
    { name: "HAPI", category: "backend", pattern: /from\s+['"]@hapi\//i },
    { name: "ELYSIA", category: "backend", pattern: /from\s+['"]elysia['"]/i },
    // HTTP clients
    { name: "AXIOS", category: "http-client", pattern: /from\s+['"]axios['"]/i },
    { name: "GOT", category: "http-client", pattern: /from\s+['"]got['"]/i },
    { name: "NODEFETCH", category: "http-client", pattern: /from\s+['"]node-fetch['"]/i },
    { name: "KY", category: "http-client", pattern: /from\s+['"]ky['"]/i },
    { name: "SUPERAGENT", category: "http-client", pattern: /from\s+['"]superagent['"]/i },
    // Database / ORM
    { name: "PRISMA", category: "database", pattern: /from\s+['"]@prisma\//i },
    { name: "MONGOOSE", category: "database", pattern: /from\s+['"]mongoose['"]/i },
    { name: "TYPEORM", category: "database", pattern: /from\s+['"]typeorm['"]/i },
    { name: "SEQUELIZE", category: "database", pattern: /from\s+['"]sequelize['"]/i },
    { name: "DRIZZLE", category: "database", pattern: /from\s+['"]drizzle-orm\//i },
    { name: "KNEX", category: "database", pattern: /from\s+['"]knex['"]/i },
    // Testing
    { name: "JEST", category: "testing", pattern: /from\s+['"](?:jest|@jest\/)['"]|require\(['"]jest['"]\)/i },
    { name: "VITEST", category: "testing", pattern: /from\s+['"]vitest['"]/i },
    { name: "MOCHA", category: "testing", pattern: /from\s+['"]mocha['"]/i },
    { name: "PLAYWRIGHT", category: "testing", pattern: /from\s+['"]@playwright\//i },
    { name: "CYPRESS", category: "testing", pattern: /from\s+['"]cypress['"]/i },
    // Build tools
    { name: "VITE", category: "build", pattern: /from\s+['"]vite['"]/i },
    { name: "WEBPACK", category: "build", pattern: /from\s+['"]webpack['"]/i },
    { name: "ROLLUP", category: "build", pattern: /from\s+['"]rollup['"]/i },
    // State management
    { name: "REDUX", category: "state", pattern: /from\s+['"](?:redux|@reduxjs\/)\//i },
    { name: "ZUSTAND", category: "state", pattern: /from\s+['"]zustand['"]/i },
    { name: "JOTAI", category: "state", pattern: /from\s+['"]jotai['"]/i },
    { name: "RECOIL", category: "state", pattern: /from\s+['"]recoil['"]/i },
    { name: "MOBX", category: "state", pattern: /from\s+['"]mobx['"]/i },
    // Auth
    { name: "PASSPORT", category: "auth", pattern: /from\s+['"]passport['"]/i },
    { name: "NEXTAUTH", category: "auth", pattern: /from\s+['"]next-auth['"]/i },
    { name: "LUCIA", category: "auth", pattern: /from\s+['"]lucia['"]/i },
    { name: "JOSE", category: "auth", pattern: /from\s+['"]jose['"]/i },
    // Cloud / infra
    { name: "AWSSDK", category: "infra", pattern: /from\s+['"]@aws-sdk\//i },
    { name: "FIREBASE", category: "infra", pattern: /from\s+['"]firebase\//i },
    { name: "SUPABASE", category: "infra", pattern: /from\s+['"]@supabase\//i },
];

// ─── File extensions to scan ──────────────────────────────────────────────────
const SCANNABLE_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".mts", ".cts", ".vue", ".svelte", ".astro",
]);

// ─── Directories to skip ──────────────────────────────────────────────────────
const SKIP_DIRS = new Set([
    "node_modules", ".git", "dist", "build", ".next",
    ".nuxt", ".svelte-kit", "out", "coverage", ".turbo",
    ".cache", "__pycache__", ".venv", "venv",
]);

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeHash(content: string): string {
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 8).toUpperCase();
}

function extractImportedSymbols(importLine: string): string[] {
    const symbols: string[] = [];
    // import { a, b as c } from '...'
    const namedMatch = importLine.match(/import\s*\{([^}]+)\}/);
    if (namedMatch && namedMatch[1]) {
        for (const part of namedMatch[1].split(",")) {
            const clean = part.trim();
            if (clean) {
                const aliasMatch = clean.match(/\s+as\s+(\w+)/);
                if (aliasMatch && aliasMatch[1]) {
                    symbols.push(aliasMatch[1]);
                } else {
                    const idMatch = clean.match(/^(\w+)/);
                    if (idMatch && idMatch[1]) symbols.push(idMatch[1]);
                }
            }
        }
    }
    // import DefaultName from '...'
    const defaultMatch = importLine.match(/import\s+([A-Za-z0-9_$]+)\s*(?:,|\s+from)/);
    if (defaultMatch && defaultMatch[1] && defaultMatch[1] !== "type") {
        symbols.push(defaultMatch[1]);
    }
    // const x = require('...')
    const requireMatch = importLine.match(/(?:const|let|var)\s+([A-Za-z0-9_$]+|\{[^}]+\})\s*=\s*require/);
    if (requireMatch && requireMatch[1]) {
        if (requireMatch[1].startsWith("{")) {
            const inner = requireMatch[1].slice(1, -1);
            for (const s of inner.split(",")) {
                const id = s.trim().split(":")[0]?.trim();
                if (id) symbols.push(id);
            }
        } else {
            symbols.push(requireMatch[1]);
        }
    }
    return symbols;
}

function isTechUsedInBody(content: string, techName: string, symbols: string[]): boolean {
    const lines = content.split("\n");
    // Exclude import statements and top-level comments to check the actual code body
    const bodyLines = lines.filter((l) => {
        const trimmed = l.trim();
        return !trimmed.startsWith("import ") &&
               !trimmed.startsWith("import{") &&
               !trimmed.startsWith("export * from") &&
               !trimmed.startsWith("//") &&
               !trimmed.startsWith("/*") &&
               !trimmed.startsWith("*");
    });
    const bodyText = bodyLines.join("\n");

    // Check if any explicitly imported identifier appears in the body
    for (const sym of symbols) {
        if (!sym || sym.length < 2) continue;
        const symRegex = new RegExp(`\\b${sym}\\b`);
        if (symRegex.test(bodyText)) {
            return true;
        }
    }

    // Technology-specific heuristic patterns
    switch (techName.toUpperCase()) {
        case "REACT":
            return /<[A-Z][A-Za-z0-9]*|<\/|<React\.|use[A-Z][a-zA-Z0-9]*|React\./.test(bodyText);
        case "NEXTJS":
            return /useRouter|Link|Image|getServerSideProps|getStaticProps|NextResponse|NextRequest|redirect\(|notFound\(/.test(bodyText);
        case "EXPRESS":
            return /express\(|\.get\(|\.post\(|\.use\(|\.listen\(|Router\(/.test(bodyText);
        case "SUPABASE":
            return /createClient|supabase\.from|supabase\.auth|\.select\(|\.insert\(|\.update\(/.test(bodyText);
        case "AXIOS":
            return /axios\.get|axios\.post|axios\.put|axios\.delete|axios\(/.test(bodyText);
        case "PRISMA":
            return /prisma\.|new PrismaClient|\$queryRaw/.test(bodyText);
        case "TAILWIND":
            return /className=/.test(bodyText);
        case "VUE":
            return /<template|<script|defineComponent|ref\(|reactive\(/.test(bodyText);
        case "SVELTE":
            return /<script|\$state|\$derived/.test(bodyText);
        case "REDUX":
            return /useSelector|useDispatch|createSlice|configureStore/.test(bodyText);
        case "ZUSTAND":
            return /create\(|createStore\(/.test(bodyText);
    }

    const techRegex = new RegExp(`\\b${techName}\\b`, "i");
    return techRegex.test(bodyText);
}

function detectImports(content: string): TechImport[] {
    const found: TechImport[] = [];
    const lines = content.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import") && !trimmed.startsWith("require") && !trimmed.startsWith("from")) {
            continue;
        }
        for (const tech of TECH_PATTERNS) {
            if (tech.pattern.test(trimmed)) {
                if (!found.some((f) => f.techName === tech.name)) {
                    const symbols = extractImportedSymbols(trimmed);
                    const isUsed = isTechUsedInBody(content, tech.name, symbols);
                    found.push({
                        techName: tech.name,
                        category: tech.category,
                        importLine: trimmed.slice(0, 100),
                        isUsedInBody: isUsed,
                    });
                }
            }
        }
    }
    return found;
}

function truncateTo(s: string, len: number): string {
    return s.length > len ? s.slice(0, len) : s;
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

export async function scanRepository(
    repoPath: string,
    onProgress?: (scanned: number, found: number) => void,
): Promise<ScanResult> {
    const abs = path.resolve(repoPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        throw new Error(`Repository path does not exist or is not a directory: ${repoPath}`);
    }

    const scannedFiles: ScannedFile[] = [];
    let scannedCount = 0;

    function walk(dir: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return; // skip unreadable dirs
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                if (SKIP_DIRS.has(ent.name)) continue;
                walk(full);
            } else if (ent.isFile()) {
                const ext = path.extname(ent.name).toLowerCase();
                if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

                let content: string;
                try {
                    const stat = fs.statSync(full);
                    if (stat.size > 2 * 1024 * 1024) continue; // skip >2MB files
                    content = fs.readFileSync(full, "utf-8");
                } catch {
                    continue;
                }

                const relativePath = path.relative(abs, full).replace(/\\/g, "/");
                const contentHash = computeHash(content);
                const imports = detectImports(content);

                scannedFiles.push({
                    relativePath,
                    absolutePath: full,
                    contentHash,
                    sizeBytes: Buffer.byteLength(content, "utf-8"),
                    extension: ext,
                    imports,
                    importCount: imports.length,
                });

                scannedCount++;
                if (onProgress && scannedCount % 50 === 0) {
                    onProgress(scannedCount, scannedFiles.filter((f) => f.imports.length > 0).length);
                }
            }
        }
    }

    walk(abs);

    // Build flat file records — one per (file, technology) combination
    const records: FlatFileRecord[] = [];
    for (const file of scannedFiles) {
        if (file.imports.length === 0) continue;
        for (const imp of file.imports) {
            records.push({
                filePath: truncateTo(file.relativePath, 40),
                fullPath: file.relativePath,
                techName: truncateTo(imp.techName, 10),
                contentHash: file.contentHash,
                usageType: imp.isUsedInBody ? "GENUINE" : "PSEUDO",
                importCount: Math.min(file.importCount, 9999),
            });
        }
    }

    return {
        repoPath: abs,
        scannedAt: new Date(),
        totalFiles: scannedCount,
        filesWithImports: scannedFiles.filter((f) => f.imports.length > 0).length,
        records,
        scannedFiles,
    };
}

/**
 * Apply AI usage judgments back to the flat file records.
 * The AI returns a mapping of filePath -> usageType for files it has evaluated.
 */
export function applyAiJudgments(
    result: ScanResult,
    judgments: Map<string, UsageType>,
): void {
    for (const record of result.records) {
        const judgment = (record.fullPath && judgments.get(record.fullPath)) ||
                         judgments.get(record.filePath);
        if (judgment) {
            record.usageType = judgment;
        }
    }
}
