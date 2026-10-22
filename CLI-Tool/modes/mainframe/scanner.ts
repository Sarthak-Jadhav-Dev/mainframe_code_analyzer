/**
 * Mainframe Codebase Auditor — Repository Scanner
 * -------------------------------------------------
 * Scans a local codebase, detects technology imports/usages,
 * computes content hashes, and prepares records for the
 * fixed-width flat file that will be sent to Hercules.
 *
 * Languages supported:
 *   Mainframe : COBOL, JCL, REXX, PL/I, Assembler (HLASM)
 *   Systems   : C, C++
 *   JVM       : Java, Kotlin, Scala, Groovy
 *   Scripting : Python, Ruby, Perl, Shell/Bash
 *   Web/JS    : TypeScript, JavaScript, Vue, Svelte, Astro
 *   Data      : SQL, XML, YAML, TOML, JSON (config-only)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { TechImport, ScannedFile, ScanResult, FlatFileRecord, UsageType } from "./types.ts";

// ─── Language Families ────────────────────────────────────────────────────────

type LanguageFamily =
    | "mainframe" | "c-family" | "jvm" | "python" | "scripting" | "web-js" | "data" | "config";

interface LanguageSpec {
    family: LanguageFamily;
    /** Human-readable language name used in records */
    langName: string;
    /** How to detect "imports" / dependencies in this language */
    importStyle: "jcl" | "cobol" | "rexx" | "c-include" | "java" | "python" | "js-esm" | "sql" | "none";
}

const EXTENSION_MAP: Record<string, LanguageSpec> = {
    // ── Mainframe ────────────────────────────────────────────────────────
    ".jcl":   { family: "mainframe", langName: "JCL",       importStyle: "jcl"     },
    ".cbl":   { family: "mainframe", langName: "COBOL",     importStyle: "cobol"   },
    ".cob":   { family: "mainframe", langName: "COBOL",     importStyle: "cobol"   },
    ".cobol": { family: "mainframe", langName: "COBOL",     importStyle: "cobol"   },
    ".cpy":   { family: "mainframe", langName: "COBOL",     importStyle: "cobol"   },
    ".rexx":  { family: "mainframe", langName: "REXX",      importStyle: "rexx"    },
    ".rex":   { family: "mainframe", langName: "REXX",      importStyle: "rexx"    },
    ".exec":  { family: "mainframe", langName: "REXX",      importStyle: "rexx"    },
    ".rx":    { family: "mainframe", langName: "REXX",      importStyle: "rexx"    },
    ".pli":   { family: "mainframe", langName: "PLI",       importStyle: "none"    },
    ".pl1":   { family: "mainframe", langName: "PLI",       importStyle: "none"    },
    ".asm":   { family: "mainframe", langName: "ASSEMBLER", importStyle: "none"    },
    ".hlasm": { family: "mainframe", langName: "ASSEMBLER", importStyle: "none"    },
    ".mac":   { family: "mainframe", langName: "ASSEMBLER", importStyle: "none"    },
    // ── C / C++ ──────────────────────────────────────────────────────────
    ".c":     { family: "c-family",  langName: "C",         importStyle: "c-include" },
    ".h":     { family: "c-family",  langName: "C",         importStyle: "c-include" },
    ".cpp":   { family: "c-family",  langName: "CPP",       importStyle: "c-include" },
    ".cxx":   { family: "c-family",  langName: "CPP",       importStyle: "c-include" },
    ".cc":    { family: "c-family",  langName: "CPP",       importStyle: "c-include" },
    ".hpp":   { family: "c-family",  langName: "CPP",       importStyle: "c-include" },
    ".hxx":   { family: "c-family",  langName: "CPP",       importStyle: "c-include" },
    // ── JVM ──────────────────────────────────────────────────────────────
    ".java":  { family: "jvm",       langName: "JAVA",      importStyle: "java"    },
    ".kt":    { family: "jvm",       langName: "KOTLIN",    importStyle: "java"    },
    ".kts":   { family: "jvm",       langName: "KOTLIN",    importStyle: "java"    },
    ".scala": { family: "jvm",       langName: "SCALA",     importStyle: "java"    },
    ".groovy":{ family: "jvm",       langName: "GROOVY",    importStyle: "java"    },
    // ── Python ───────────────────────────────────────────────────────────
    ".py":    { family: "python",    langName: "PYTHON",    importStyle: "python"  },
    ".pyw":   { family: "python",    langName: "PYTHON",    importStyle: "python"  },
    // ── Scripting ────────────────────────────────────────────────────────
    ".sh":    { family: "scripting", langName: "SHELL",     importStyle: "none"    },
    ".bash":  { family: "scripting", langName: "SHELL",     importStyle: "none"    },
    ".rb":    { family: "scripting", langName: "RUBY",      importStyle: "none"    },
    ".pl":    { family: "scripting", langName: "PERL",      importStyle: "none"    },
    ".pm":    { family: "scripting", langName: "PERL",      importStyle: "none"    },
    // ── Web / JS ─────────────────────────────────────────────────────────
    ".ts":    { family: "web-js",    langName: "TYPESCRIPT",importStyle: "js-esm"  },
    ".tsx":   { family: "web-js",    langName: "TYPESCRIPT",importStyle: "js-esm"  },
    ".mts":   { family: "web-js",    langName: "TYPESCRIPT",importStyle: "js-esm"  },
    ".js":    { family: "web-js",    langName: "JAVASCRIPT",importStyle: "js-esm"  },
    ".jsx":   { family: "web-js",    langName: "JAVASCRIPT",importStyle: "js-esm"  },
    ".mjs":   { family: "web-js",    langName: "JAVASCRIPT",importStyle: "js-esm"  },
    ".cjs":   { family: "web-js",    langName: "JAVASCRIPT",importStyle: "js-esm"  },
    ".vue":   { family: "web-js",    langName: "VUE",       importStyle: "js-esm"  },
    ".svelte":{ family: "web-js",    langName: "SVELTE",    importStyle: "js-esm"  },
    ".astro": { family: "web-js",    langName: "ASTRO",     importStyle: "js-esm"  },
    // ── SQL / Data ───────────────────────────────────────────────────────
    ".sql":   { family: "data",      langName: "SQL",       importStyle: "sql"     },
    ".xml":   { family: "data",      langName: "XML",       importStyle: "none"    },
};

// ─── Technology Detection Patterns ───────────────────────────────────────────

interface TechPattern {
    name: string;
    category: string;
    /** Families this pattern applies to (undefined = all) */
    families?: LanguageFamily[];
    pattern: RegExp;
}

const TECH_PATTERNS: TechPattern[] = [
    // ── JCL constructs ───────────────────────────────────────────────────────
    { name: "JCL-SORT",    category: "jcl-utility",  families: ["mainframe"], pattern: /PGM=SORT\b/i },
    { name: "JCL-IEFBR14",category: "jcl-utility",  families: ["mainframe"], pattern: /PGM=IEFBR14\b/i },
    { name: "JCL-IEBGENER",category:"jcl-utility",  families: ["mainframe"], pattern: /PGM=IEBGENER\b/i },
    { name: "JCL-IEBCOPY", category: "jcl-utility",  families: ["mainframe"], pattern: /PGM=IEBCOPY\b/i },
    { name: "JCL-IDCAMS",  category: "jcl-utility",  families: ["mainframe"], pattern: /PGM=IDCAMS\b/i },
    { name: "DFSORT",      category: "jcl-utility",  families: ["mainframe"], pattern: /DFSORT|SORTLIB/i },
    { name: "DB2-JCL",     category: "database",     families: ["mainframe"], pattern: /PGM=DSNUTILB|PGM=IKJEFT01|DSNHDECP/i },
    { name: "CICS-JCL",    category: "middleware",   families: ["mainframe"], pattern: /PGM=DFHSIP|CICS\b/i },
    { name: "IMS-JCL",     category: "database",     families: ["mainframe"], pattern: /PGM=DFSRRC00|PGM=DFSURGL0|IMS\b/i },
    { name: "MQ-JCL",      category: "messaging",    families: ["mainframe"], pattern: /PGM=CSQUTIL|MQSERIES/i },
    // ── COBOL statements & copybooks ─────────────────────────────────────────
    { name: "COBOL-DB2",   category: "database",     families: ["mainframe"], pattern: /EXEC\s+SQL\b|INCLUDE\s+SQLCA|DCLGEN/i },
    { name: "COBOL-CICS",  category: "middleware",   families: ["mainframe"], pattern: /EXEC\s+CICS\b/i },
    { name: "COBOL-IMS",   category: "database",     families: ["mainframe"], pattern: /EXEC\s+DLI\b|PCB\s+TYPE=/i },
    { name: "COBOL-FILE",  category: "io",           families: ["mainframe"], pattern: /COPY\s+\w+|CALL\s+['"][^'"]+['"]/i },
    { name: "COBOL-SORT",  category: "jcl-utility",  families: ["mainframe"], pattern: /\bSORT\s+\w|\bMERGE\s+\w/i },
    // ── REXX functions & facilities ──────────────────────────────────────────
    { name: "REXX-TSO",    category: "mainframe-api",families: ["mainframe"], pattern: /\bADDRESS\s+TSO\b/i },
    { name: "REXX-ISPF",   category: "mainframe-api",families: ["mainframe"], pattern: /\bADDRESS\s+ISPF\b|\bISPEXEC\b/i },
    { name: "REXX-MVS",    category: "mainframe-api",families: ["mainframe"], pattern: /\bADDRESS\s+MVS\b/i },
    { name: "REXX-SQL",    category: "database",     families: ["mainframe"], pattern: /\bADDRESS\s+DSNREXX\b|EXECSQL/i },
    { name: "REXX-SYSVAR", category: "mainframe-api",families: ["mainframe"], pattern: /\bSYSVAR\(|MVSVAR\(/i },
    // ── C / C++ libraries ────────────────────────────────────────────────────
    { name: "STDLIB-C",    category: "c-stdlib",     families: ["c-family"],  pattern: /#include\s*[<"](?:stdio|stdlib|string|math|time|assert|ctype|errno|float|limits|locale|setjmp|signal|stdarg|stdbool|stddef|stdint|unistd)\.h[>"]/i },
    { name: "POSIX",       category: "c-stdlib",     families: ["c-family"],  pattern: /#include\s*[<"](?:pthread|sys\/socket|sys\/types|sys\/stat|netinet|arpa|dirent|fcntl|poll|select)\.h[>"]/i },
    { name: "OPENSSL",     category: "security",     families: ["c-family"],  pattern: /#include\s*[<"]openssl\//i },
    { name: "LIBCURL",     category: "http-client",  families: ["c-family"],  pattern: /#include\s*[<"]curl\//i },
    { name: "SQLITE-C",    category: "database",     families: ["c-family"],  pattern: /#include\s*[<"]sqlite3\.h[>"]/i },
    { name: "ZLIB",        category: "compression",  families: ["c-family"],  pattern: /#include\s*[<"]zlib\.h[>"]/i },
    { name: "BOOST",       category: "cpp-lib",      families: ["c-family"],  pattern: /#include\s*[<"]boost\//i },
    { name: "STL",         category: "cpp-lib",      families: ["c-family"],  pattern: /#include\s*[<"](?:vector|map|set|list|deque|queue|stack|algorithm|memory|functional|iterator|string|iostream|fstream|sstream)[>"]/i },
    { name: "QT",          category: "cpp-gui",      families: ["c-family"],  pattern: /#include\s*[<"]Q[A-Z]\w+[>"]/i },
    { name: "POCO",        category: "cpp-lib",      families: ["c-family"],  pattern: /#include\s*[<"]Poco\//i },
    // ── Java / JVM imports ───────────────────────────────────────────────────
    { name: "SPRING",      category: "jvm-fw",       families: ["jvm"],       pattern: /import\s+org\.springframework\./i },
    { name: "SPRING-BOOT", category: "jvm-fw",       families: ["jvm"],       pattern: /import\s+org\.springframework\.boot\./i },
    { name: "JAKARTA-EE",  category: "jvm-fw",       families: ["jvm"],       pattern: /import\s+jakarta\.|import\s+javax\./i },
    { name: "HIBERNATE",   category: "database",     families: ["jvm"],       pattern: /import\s+org\.hibernate\./i },
    { name: "JDBC",        category: "database",     families: ["jvm"],       pattern: /import\s+java\.sql\./i },
    { name: "LOG4J",       category: "logging",      families: ["jvm"],       pattern: /import\s+org\.apache\.log4j\.|import\s+org\.apache\.logging\./i },
    { name: "SLF4J",       category: "logging",      families: ["jvm"],       pattern: /import\s+org\.slf4j\./i },
    { name: "JUNIT",       category: "testing",      families: ["jvm"],       pattern: /import\s+org\.junit\./i },
    { name: "MOCKITO",     category: "testing",      families: ["jvm"],       pattern: /import\s+org\.mockito\./i },
    { name: "KAFKA-JAVA",  category: "messaging",    families: ["jvm"],       pattern: /import\s+org\.apache\.kafka\./i },
    { name: "HADOOP",      category: "big-data",     families: ["jvm"],       pattern: /import\s+org\.apache\.hadoop\./i },
    { name: "SPARK",       category: "big-data",     families: ["jvm"],       pattern: /import\s+org\.apache\.spark\./i },
    { name: "GRPC-JAVA",   category: "rpc",          families: ["jvm"],       pattern: /import\s+io\.grpc\./i },
    { name: "AWSSDK-JAVA", category: "cloud",        families: ["jvm"],       pattern: /import\s+com\.amazonaws\.|import\s+software\.amazon\.awssdk\./i },
    // ── Python imports ───────────────────────────────────────────────────────
    { name: "DJANGO",      category: "py-fw",        families: ["python"],    pattern: /(?:^|\n)\s*(?:import|from)\s+django\b/i },
    { name: "FLASK",       category: "py-fw",        families: ["python"],    pattern: /(?:^|\n)\s*(?:import|from)\s+flask\b/i },
    { name: "FASTAPI",     category: "py-fw",        families: ["python"],    pattern: /(?:^|\n)\s*(?:import|from)\s+fastapi\b/i },
    { name: "NUMPY",       category: "py-science",   families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+numpy|from\s+numpy)\b/i },
    { name: "PANDAS",      category: "py-science",   families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+pandas|from\s+pandas)\b/i },
    { name: "SCIPY",       category: "py-science",   families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+scipy|from\s+scipy)\b/i },
    { name: "MATPLOTLIB",  category: "py-science",   families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+matplotlib|from\s+matplotlib)\b/i },
    { name: "SKLEARN",     category: "py-ml",        families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+sklearn|from\s+sklearn)\b/i },
    { name: "TENSORFLOW",  category: "py-ml",        families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+tensorflow|from\s+tensorflow)\b/i },
    { name: "PYTORCH",     category: "py-ml",        families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+torch|from\s+torch)\b/i },
    { name: "SQLALCHEMY",  category: "database",     families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+sqlalchemy|from\s+sqlalchemy)\b/i },
    { name: "REQUESTS",    category: "http-client",  families: ["python"],    pattern: /(?:^|\n)\s*import\s+requests\b/i },
    { name: "BOTO3",       category: "cloud",        families: ["python"],    pattern: /(?:^|\n)\s*import\s+boto3\b/i },
    { name: "CELERY",      category: "task-queue",   families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+celery|from\s+celery)\b/i },
    { name: "PYDANTIC",    category: "py-lib",       families: ["python"],    pattern: /(?:^|\n)\s*(?:import\s+pydantic|from\s+pydantic)\b/i },
    { name: "ASYNCIO",     category: "py-stdlib",    families: ["python"],    pattern: /(?:^|\n)\s*import\s+asyncio\b/i },
    { name: "SUBPROCESS",  category: "py-stdlib",    families: ["python"],    pattern: /(?:^|\n)\s*import\s+subprocess\b/i },
    { name: "OS-MODULE",   category: "py-stdlib",    families: ["python"],    pattern: /(?:^|\n)\s*import\s+os\b/i },
    { name: "SYS-MODULE",  category: "py-stdlib",    families: ["python"],    pattern: /(?:^|\n)\s*import\s+sys\b/i },
    // ── Web / JS frameworks ──────────────────────────────────────────────────
    { name: "REACT",       category: "frontend-fw",  families: ["web-js"],    pattern: /from\s+['"]react['"]/i },
    { name: "VUE",         category: "frontend-fw",  families: ["web-js"],    pattern: /from\s+['"]vue['"]/i },
    { name: "ANGULAR",     category: "frontend-fw",  families: ["web-js"],    pattern: /from\s+['"]@angular\//i },
    { name: "SVELTE",      category: "frontend-fw",  families: ["web-js"],    pattern: /from\s+['"]svelte['"]/i },
    { name: "SOLIDJS",     category: "frontend-fw",  families: ["web-js"],    pattern: /from\s+['"]solid-js['"]/i },
    { name: "NEXTJS",      category: "meta-fw",      families: ["web-js"],    pattern: /from\s+['"]next(?:\/|['"])/i },
    { name: "NUXT",        category: "meta-fw",      families: ["web-js"],    pattern: /from\s+['"](?:#app|nuxt)['"]/i },
    { name: "REMIX",       category: "meta-fw",      families: ["web-js"],    pattern: /from\s+['"]@remix-run\//i },
    { name: "ASTRO",       category: "meta-fw",      families: ["web-js"],    pattern: /from\s+['"]astro['"]/i },
    { name: "EXPRESS",     category: "backend",      families: ["web-js"],    pattern: /require\(['"]express['"]\)|from\s+['"]express['"]/i },
    { name: "FASTIFY",     category: "backend",      families: ["web-js"],    pattern: /from\s+['"]fastify['"]/i },
    { name: "NESTJS",      category: "backend",      families: ["web-js"],    pattern: /from\s+['"]@nestjs\//i },
    { name: "AXIOS",       category: "http-client",  families: ["web-js"],    pattern: /from\s+['"]axios['"]/i },
    { name: "PRISMA",      category: "database",     families: ["web-js"],    pattern: /from\s+['"]@prisma\//i },
    { name: "MONGOOSE",    category: "database",     families: ["web-js"],    pattern: /from\s+['"]mongoose['"]/i },
    { name: "TYPEORM",     category: "database",     families: ["web-js"],    pattern: /from\s+['"]typeorm['"]/i },
    { name: "DRIZZLE",     category: "database",     families: ["web-js"],    pattern: /from\s+['"]drizzle-orm\//i },
    { name: "REDUX",       category: "state",        families: ["web-js"],    pattern: /from\s+['"](?:redux|@reduxjs\/)\//i },
    { name: "ZUSTAND",     category: "state",        families: ["web-js"],    pattern: /from\s+['"]zustand['"]/i },
    { name: "AWSSDK",      category: "cloud",        families: ["web-js"],    pattern: /from\s+['"]@aws-sdk\//i },
    { name: "FIREBASE",    category: "cloud",        families: ["web-js"],    pattern: /from\s+['"]firebase\//i },
    { name: "SUPABASE",    category: "cloud",        families: ["web-js"],    pattern: /from\s+['"]@supabase\//i },
    { name: "JEST",        category: "testing",      families: ["web-js"],    pattern: /from\s+['"](?:jest|@jest\/)['"]/i },
    { name: "VITEST",      category: "testing",      families: ["web-js"],    pattern: /from\s+['"]vitest['"]/i },
    { name: "PLAYWRIGHT",  category: "testing",      families: ["web-js"],    pattern: /from\s+['"]@playwright\//i },
];

// ─── Extensions to scan ───────────────────────────────────────────────────────

const SCANNABLE_EXTENSIONS = new Set(Object.keys(EXTENSION_MAP));

// ─── Directories / files to skip ─────────────────────────────────────────────

const SKIP_DIRS = new Set([
    "node_modules", ".git", "dist", "build", ".next",
    ".nuxt", ".svelte-kit", "out", "coverage", ".turbo",
    ".cache", "__pycache__", ".venv", "venv", "env",
    "target", ".gradle", ".mvn", "bin", "obj",
]);

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeHash(content: string): string {
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 8).toUpperCase();
}

/**
 * For a given file (content + extension), scan each line for matches against
 * the relevant TECH_PATTERNS (filtered by language family).
 */
function detectImports(content: string, langSpec: LanguageSpec): TechImport[] {
    const found: TechImport[] = [];
    const family = langSpec.family;
    const lines = content.split("\n");

    // Filter patterns applicable to this language family
    const applicablePatterns = TECH_PATTERNS.filter(
        (p) => !p.families || p.families.includes(family),
    );

    // For mainframe files (COBOL/JCL/REXX), scan all lines — not just import lines
    const checkAll = family === "mainframe" || family === "c-family" || family === "data";

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("//--") /* JCL comment */) continue;

        // For JS/Python/Java, skip lines that don't look like imports
        if (!checkAll) {
            if (langSpec.importStyle === "js-esm") {
                if (!trimmed.startsWith("import") && !trimmed.startsWith("require") && !trimmed.startsWith("from")) continue;
            } else if (langSpec.importStyle === "python") {
                if (!trimmed.startsWith("import") && !trimmed.startsWith("from")) continue;
            } else if (langSpec.importStyle === "java") {
                if (!trimmed.startsWith("import") && !trimmed.startsWith("package")) continue;
            }
        }

        for (const tech of applicablePatterns) {
            if (tech.pattern.test(trimmed)) {
                if (!found.some((f) => f.techName === tech.name)) {
                    found.push({
                        techName: tech.name,
                        category: tech.category,
                        importLine: trimmed.slice(0, 100),
                        isUsedInBody: true, // Mainframe/C/Java references ARE usage
                    });
                }
            }
        }
    }

    // For mainframe-native files that have no specific patterns but are
    // identifiable by language, emit one "language-presence" record
    if (found.length === 0 && family === "mainframe") {
        found.push({
            techName: langSpec.langName,
            category: "mainframe",
            importLine: `[${langSpec.langName} source file]`,
            isUsedInBody: true,
        });
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
    targetSubpaths?: string[],
    subScope?: string,
): Promise<ScanResult> {
    const abs = path.resolve(repoPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        throw new Error(`Repository path does not exist or is not a directory: ${repoPath}`);
    }

    const scannedFiles: ScannedFile[] = [];
    let scannedCount = 0;
    const visitedFiles = new Set<string>();

    function processFile(full: string) {
        if (visitedFiles.has(full)) return;
        visitedFiles.add(full);

        const ext = path.extname(full).toLowerCase();
        const langSpec = EXTENSION_MAP[ext];
        if (!langSpec) return;

        let content: string;
        try {
            const stat = fs.statSync(full);
            if (stat.size > 2 * 1024 * 1024) return; // skip >2MB
            content = fs.readFileSync(full, "utf-8");
        } catch {
            return;
        }

        const relativePath = path.relative(abs, full).replace(/\\/g, "/");
        const contentHash = computeHash(content);
        const imports = detectImports(content, langSpec);

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
                processFile(full);
            }
        }
    }

    if (targetSubpaths && targetSubpaths.length > 0) {
        for (const sub of targetSubpaths) {
            const targetAbs = path.resolve(abs, sub);
            if (!fs.existsSync(targetAbs)) continue;
            try {
                const stat = fs.statSync(targetAbs);
                if (stat.isDirectory()) {
                    walk(targetAbs);
                } else if (stat.isFile()) {
                    processFile(targetAbs);
                }
            } catch {}
        }
    } else {
        walk(abs);
    }

    // Final progress update
    if (onProgress) onProgress(scannedCount, scannedFiles.filter((f) => f.imports.length > 0).length);

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
        subScope,
        targetSubpaths,
        scannedAt: new Date(),
        totalFiles: scannedCount,
        filesWithImports: scannedFiles.filter((f) => f.imports.length > 0).length,
        records,
        scannedFiles,
    };
}

/**
 * Apply AI usage judgments back to the flat file records.
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
