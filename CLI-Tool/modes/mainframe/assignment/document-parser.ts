/**
 * Assignment Mode — Document Parser
 * -----------------------------------
 * Extracts text, code blocks, rendered page images, and Z_IDs from PDF and DOCX.
 *
 * PDF  → uses pdf-parse for text + pdfjs-dist+canvas to render every page as a PNG
 *         so that screenshots of code inside the PDF get OCR'd by the AI.
 * DOCX → uses mammoth for HTML/text + adm-zip to unpack embedded images.
 *
 * Key insight: many student submissions contain code ONLY as screenshots inside the
 * PDF.  pdf-parse only reads selectable text — it misses rasterised images completely.
 * We therefore render every page of the PDF to a PNG and hand each page image to the
 * AI vision OCR step, guaranteeing code in screenshots is captured.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ParsedDocument, ExtractedCodeBlock, ExtractedImage } from "./types.ts";

// ─── Z_ID Pattern ─────────────────────────────────────────────────────────────
const Z_ID_PATTERN = /\bZ[\s-]?[0-9]{7,10}\b/gi;

// ─── Code Detection ───────────────────────────────────────────────────────────

const CODE_KEYWORD_PATTERNS = [
    /^(import |from |def |class |if __name__|async def )/m,
    /^(const |let |var |function |export |import |class |async function )/m,
    /^(public class |private |protected |void |int |String |#include )/m,
    /^(IDENTIFICATION DIVISION|ENVIRONMENT DIVISION|DATA DIVISION|PROCEDURE DIVISION|WORKING-STORAGE|PERFORM |MOVE |DISPLAY )/im,
    /^\/\/[A-Z][A-Z0-9]* +(JOB|EXEC|DD) /m,
    /^(\/\* REXX|say |do |end|if .* then|parse )/im,
    /[{};=()]{3,}/,
];

function looksLikeCode(text: string): boolean {
    if (text.length < 20) return false;
    return CODE_KEYWORD_PATTERNS.some((re) => re.test(text));
}

function detectLanguage(code: string): string {
    const upper = code.toUpperCase();
    if (/^(IDENTIFICATION DIVISION|PROCEDURE DIVISION|DATA DIVISION)/m.test(upper)) return "COBOL";
    if (/^\/\/[A-Z][A-Z0-9]* +(JOB|EXEC|DD)/m.test(upper)) return "JCL";
    if (/^(\/\* REXX|SAY |PARSE |DO )/m.test(upper)) return "REXX";
    if (/^(def |class |import |from |print\()/m.test(code)) return "Python";
    if (/^(public class|private |protected |void main)/m.test(code)) return "Java";
    if (/(#include|printf|scanf|int main)/m.test(code)) return "C/C++";
    if (/^(const |let |var |function |=>|async )/m.test(code)) return "JavaScript";
    if (/(interface |type |: string|: number|: boolean)/m.test(code)) return "TypeScript";
    if (/^(SELECT |INSERT |UPDATE |DELETE |CREATE TABLE)/im.test(code)) return "SQL";
    if (/(<html|<body|<div|<span)/i.test(code)) return "HTML";
    return "Unknown";
}

function hashCode(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex").slice(0, 8).toUpperCase();
}

function extractCodeBlocksFromText(text: string, pageNumber = 1): ExtractedCodeBlock[] {
    const blocks: ExtractedCodeBlock[] = [];
    let blockIdx = 0;

    // Try fenced blocks first
    const fenceRe = /```[\w]*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = fenceRe.exec(text)) !== null) {
        const code = (match[1] ?? "").trim();
        if (code.length > 15 && looksLikeCode(code)) {
            blocks.push({ index: blockIdx++, language: detectLanguage(code), code, source: "text", pageNumber, contentHash: hashCode(code) });
        }
    }

    // Fallback: paragraph scanning
    if (blocks.length === 0) {
        for (const para of text.split(/\n{2,}/)) {
            const trimmed = para.trim();
            if (trimmed.length > 20 && looksLikeCode(trimmed)) {
                blocks.push({ index: blockIdx++, language: detectLanguage(trimmed), code: trimmed, source: "text", pageNumber, contentHash: hashCode(trimmed) });
            }
        }
    }

    return blocks;
}

function extractZIds(text: string): string[] {
    const found = new Set<string>();
    for (const m of text.matchAll(Z_ID_PATTERN)) {
        found.add(m[0].replace(/[\s-]/g, "").toUpperCase());
    }
    return [...found];
}

// ─── PDF: Render pages to PNG via pdfjs-dist + canvas ────────────────────────

/**
 * Render every page of a PDF to a PNG image (base64) using pdfjs-dist + canvas.
 * This is the only reliable way to extract "screenshot code" from PDFs where the
 * code appears as embedded raster images rather than selectable text.
 *
 * Returns an empty array if canvas is not available (graceful fallback).
 */
async function renderPdfPagesToImages(buffer: Buffer): Promise<ExtractedImage[]> {
    try {
        // Dynamically import pdfjs-dist (legacy build works in Node/Bun)
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);

        // Disable the worker — we run in-process
        pdfjs.GlobalWorkerOptions.workerSrc = "";

        // Try to load @napi-rs/canvas — ships prebuilt Windows binaries, no C++ compiler needed
        let createCanvas: ((w: number, h: number) => any) | null = null;
        try {
            const canvasMod = await import("@napi-rs/canvas");
            createCanvas = (canvasMod as any).createCanvas ?? (canvasMod.default as any)?.createCanvas;
            if (typeof createCanvas !== "function") throw new Error("no createCanvas export");
        } catch {
            // @napi-rs/canvas not available — skip page rendering, return empty array.
            // The AI OCR step will still run on any embedded images extracted by adm-zip.
            return [];
        }

        const data = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data, verbosity: 0 });
        const pdfDoc = await loadingTask.promise;

        const images: ExtractedImage[] = [];
        const SCALE = 2.0; // 2× = ~144dpi — enough for code readability

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: SCALE });

            const canvas = createCanvas!(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const ctx = canvas.getContext("2d");

            await page.render({
                canvasContext: ctx,
                viewport,
            }).promise;

            const pngBuffer: Buffer = canvas.toBuffer("image/png");
            images.push({
                pageNumber: pageNum,
                data: pngBuffer.toString("base64"),
                mimeType: "image/png",
            });

            page.cleanup();
        }

        pdfDoc.destroy();
        return images;
    } catch {
        return [];
    }
}

// ─── PDF Parser ───────────────────────────────────────────────────────────────

async function parsePdf(filePath: string): Promise<ParsedDocument> {
    const buffer = fs.readFileSync(filePath);

    // ── Text extraction via pdf-parse
    let fullText = "";
    let pageCount = 0;
    try {
        // pdf-parse ESM build exports the function as the namespace itself (no .default)
        const pdfParseModule = await import("pdf-parse");
        const pdfParse: (buf: Buffer, opts?: object) => Promise<{ text: string; numpages: number }> =
            (pdfParseModule as any).default ?? (pdfParseModule as any);
        const data = await pdfParse(buffer, { max: 0 });
        fullText  = data.text || "";
        pageCount = data.numpages || 1;
    } catch {
        pageCount = 1;
    }

    // ── Render pages → PNG images for screenshot-code OCR
    // This is the critical step for PDFs where code lives inside images/screenshots.
    const images = await renderPdfPagesToImages(buffer);

    // ── Extract text-based code blocks (may be empty if doc is all screenshots)
    const textCodeBlocks = extractCodeBlocksFromText(fullText, 1);
    const zIds = extractZIds(fullText);

    return {
        filePath,
        fileType: "pdf",
        fullText,
        textCodeBlocks,
        images,     // ← each page as a PNG, ready for OCR
        zIds,
        pageCount,
    };
}

// ─── DOCX Parser ──────────────────────────────────────────────────────────────

async function parseDocx(filePath: string): Promise<ParsedDocument> {
    const mammoth = await import("mammoth");
    const buffer  = fs.readFileSync(filePath);

    let htmlResult  = { value: "" };
    let rawTextResult = { value: "" };

    try {
        htmlResult    = await mammoth.convertToHtml({ buffer });
        rawTextResult = await mammoth.extractRawText({ buffer });
    } catch { /* ignore */ }

    const fullText = rawTextResult.value || "";
    const html     = htmlResult.value     || "";

    // Extract code from <pre>/<code> tags in mammoth HTML output
    const preBlocks: ExtractedCodeBlock[] = [];
    let blockIdx = 0;
    const preRe = /<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi;
    let match: RegExpExecArray | null;
    while ((match = preRe.exec(html)) !== null) {
        const raw = match[1]!.replace(/<[^>]+>/g, "").trim();
        if (raw.length > 15 && looksLikeCode(raw)) {
            preBlocks.push({ index: blockIdx++, language: detectLanguage(raw), code: raw, source: "text", pageNumber: 1, contentHash: hashCode(raw) });
        }
    }

    const textCodeBlocks = preBlocks.length > 0 ? preBlocks : extractCodeBlocksFromText(fullText, 1);
    const zIds  = extractZIds(fullText);
    const images: ExtractedImage[] = [];

    // Unpack embedded images from DOCX (it is a ZIP archive)
    try {
        const AdmZipModule = await import("adm-zip");
        const AdmZip = (AdmZipModule as any).default ?? AdmZipModule;
        const zip = new AdmZip(buffer as unknown as Buffer);
        let imgIdx   = 0;
        for (const entry of zip.getEntries()) {
            const name = entry.entryName.toLowerCase();
            if (name.startsWith("word/media/") && /\.(png|jpg|jpeg|gif|bmp|tiff)$/.test(name)) {
                const ext      = path.extname(name).slice(1).toLowerCase();
                const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
                images.push({ pageNumber: Math.floor(imgIdx / 2) + 1, data: entry.getData().toString("base64"), mimeType });
                imgIdx++;
            }
        }
    } catch { /* adm-zip not available */ }

    return { filePath, fileType: "docx", fullText, textCodeBlocks, images, zIds, pageCount: 1 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a PDF or DOCX and return:
 *  - fullText           : all selectable text
 *  - textCodeBlocks     : code blocks detected from text
 *  - images             : rendered page images (PDF) or embedded media (DOCX)
 *                         ← these are what the AI Vision OCR step processes
 *  - zIds               : student IDs found in text
 *  - pageCount          : total pages
 */
export async function parseDocument(filePath: string): Promise<ParsedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    if (!fs.existsSync(filePath)) throw new Error(`Document not found: ${filePath}`);
    if (ext === ".pdf")  return parsePdf(filePath);
    if (ext === ".docx") return parseDocx(filePath);
    throw new Error(`Unsupported file type: ${ext}. Only .pdf and .docx are supported.`);
}

/** Whether PDF page rendering (@napi-rs/canvas) is available on this system */
export async function canRenderPdfPages(): Promise<boolean> {
    try {
        const mod = await import("@napi-rs/canvas");
        const fn = (mod as any).createCanvas ?? (mod.default as any)?.createCanvas;
        if (typeof fn !== "function") return false;
        await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
        return true;
    } catch {
        return false;
    }
}

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx"];
