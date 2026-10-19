import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";

let ready = false;

function ensureMarked(): void {
    if (ready) return;

    const width = Math.max(60, Math.min(process.stdout.columns || 100, 120));

    // Cast as any because markedTerminal v7 returns an extension, but @types/marked-terminal is v6
    marked.use(
        markedTerminal({
            // ── Headings ───────────────────────────────────────────────
            firstHeading: (text: string) => chalk.hex("#a855f7").bold(`━━  ${text}  ━━`),
            heading: (text: string) => chalk.hex("#00d4ff").bold(text),
            showSectionPrefix: false,

            // ── Text styling ───────────────────────────────────────────
            strong: (text: string) => chalk.bold.white(text),
            em: (text: string) => chalk.italic.hex("#facc15")(text),
            del: (text: string) => chalk.strikethrough.dim(text),

            // ── Code ───────────────────────────────────────────────────
            codespan: (text: string) => chalk.bgHex("#313244").hex("#89dceb")(` ${text} `),

            // ── Links ──────────────────────────────────────────────────
            link: (text: string) => chalk.hex("#00d4ff")(text),
            href: (href: string) => chalk.dim.underline(href),

            // ── Block elements ─────────────────────────────────────────
            blockquote: (text: string) => chalk.hex("#4ade80").italic(text),
            hr: (hrStr: string) => chalk.hex("#a855f7")(hrStr),
            table: chalk.reset,

            // ── Layout ─────────────────────────────────────────────────
            width,
            reflowText: false,
        } as any) as any
    );

    ready = true;
}

export function renderTerminalMarkdown(source: string): string {
    ensureMarked();
    const rendered = marked.parse(source.trimEnd(), { async: false }) as string;
    return rendered;
}
