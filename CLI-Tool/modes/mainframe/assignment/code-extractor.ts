/**
 * Assignment Mode — Code Extractor (AI Vision / OCR)
 * ---------------------------------------------------
 * Sends document images to an AI vision model to extract code from screenshots.
 * Also merges and deduplicates code blocks extracted from the text parser.
 */

import crypto from "node:crypto";
import { generateText } from "ai";
import { getVisionModel } from "../../../ai/ai.config.ts";
import type { ParsedDocument, ExtractedCodeBlock, ExtractedImage } from "./types.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashCode(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex").slice(0, 8).toUpperCase();
}

function detectLanguageFromOcr(code: string): string {
    const upper = code.toUpperCase();
    if (/IDENTIFICATION DIVISION|PROCEDURE DIVISION|DATA DIVISION|WORKING-STORAGE|PERFORM\s|DISPLAY\s/.test(upper)) return "COBOL";
    if (/^\/\/[A-Z0-9$#@]+ +(JOB|EXEC|DD)/m.test(upper)) return "JCL";
    if (/REXX|SAY |PARSE VAR|DO WHILE|DO FOREVER/.test(upper)) return "REXX";
    if (/^(def |class |import |from |print\()/m.test(code)) return "Python";
    if (/public class|void main|System\.out|@Override/.test(code)) return "Java";
    if (/#include|int main\(|printf\(|scanf\(/.test(code)) return "C/C++";
    if (/^(const |let |var |function |=>|async )/m.test(code)) return "JavaScript";
    if (/(interface |type .* = |: string|: number)/.test(code)) return "TypeScript";
    if (/^(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE)/im.test(code)) return "SQL";
    return "Unknown";
}

// ─── OCR via AI Vision ───────────────────────────────────────────────────────

/**
 * Send a single image to the AI vision model and ask it to extract code.
 * Returns the raw extracted code text (may be empty if no code in image).
 */
async function extractCodeFromImage(
    image: ExtractedImage,
    pageNumber: number,
    blockStartIndex: number,
): Promise<ExtractedCodeBlock[]> {
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const model = await getVisionModel();

            const { text } = await generateText({
                model,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                image: `data:${image.mimeType};base64,${image.data}`,
                            },
                            {
                                type: "text",
                                text: [
                                    "You are an expert OCR and code extraction engine analyzing a student assignment screenshot.",
                                    "The image may be a TN3270 terminal (green screen), a command terminal, or an IDE (e.g. VS Code).",
                                    "",
                                    "TASK: Extract ALL source code exactly as visible in the image.",
                                    "",
                                    "CRITICAL RULES:",
                                    "1. Extract ONLY the code. Strip away terminal titlebars, OS window chrome, and status lines.",
                                    "2. Strip line numbers at the start of lines (e.g., '000100', '1 |') so only the pure code remains.",
                                    "3. For COBOL, JCL, and REXX, preserve proper keywords, indentation, and structure.",
                                    "4. If multiple programs or routines appear, separate them with '--- CODE BLOCK ---'.",
                                    "5. If there is NO computer code visible in this image, respond with ONLY: NO_CODE",
                                    "6. Return ONLY the code. Do NOT add markdown code fences (```) or conversational text.",
                                ].join("\n"),
                            },
                        ],
                    },
                ],
            });

            if (!text || text.trim() === "NO_CODE" || text.trim().length < 10) {
                return [];
            }

            // Split by separator if multiple blocks
            const rawBlocks = text.split(/---\s*CODE BLOCK\s*---/i);
            const results: ExtractedCodeBlock[] = [];

            let idx = blockStartIndex;
            for (const rawCode of rawBlocks) {
                const code = rawCode.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
                if (code.length < 10) continue;
                results.push({
                    index: idx++,
                    language: detectLanguageFromOcr(code),
                    code,
                    source: "ocr",
                    pageNumber,
                    contentHash: hashCode(code),
                });
            }

            return results;
        } catch {
            if (attempt === maxRetries) {
                return [];
            }
            // Small pause before retry
            await new Promise((resolve) => setTimeout(resolve, 800));
        }
    }
    return [];
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Remove duplicate code blocks (same content hash) keeping the first occurrence.
 * Reassigns sequential indices after deduplication.
 */
function deduplicateBlocks(blocks: ExtractedCodeBlock[]): ExtractedCodeBlock[] {
    const seen = new Set<string>();
    const unique: ExtractedCodeBlock[] = [];
    let idx = 0;
    for (const block of blocks) {
        if (!seen.has(block.contentHash)) {
            seen.add(block.contentHash);
            unique.push({ ...block, index: idx++ });
        }
    }
    return unique;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CodeExtractionResult {
    allBlocks: ExtractedCodeBlock[];
    textBlocks: ExtractedCodeBlock[];
    ocrBlocks: ExtractedCodeBlock[];
    duplicatesRemoved: number;
    imagesProcessed: number;
}

/**
 * Extract all code blocks from a parsed document:
 * 1. Text-based blocks from the parser (already in ParsedDocument)
 * 2. OCR blocks from each embedded image (via AI vision with parallel batching)
 * 3. Deduplicate by content hash
 */
export async function extractAllCodeBlocks(
    parsedDoc: ParsedDocument,
    onProgress?: (done: number, total: number, source: string) => void,
): Promise<CodeExtractionResult> {
    const textBlocks = parsedDoc.textCodeBlocks;
    const ocrBlocks: ExtractedCodeBlock[] = [];

    const images = parsedDoc.images;
    const total = images.length;

    // Process images in parallel batches of 3 to speed up extraction by 3x-4x
    const BATCH_SIZE = 3;
    let completedCount = 0;

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (img, offset) => {
            const blockStart = textBlocks.length + ocrBlocks.length + offset * 5;
            const extracted = await extractCodeFromImage(img, img.pageNumber, blockStart);
            completedCount++;
            onProgress?.(completedCount, total, `Image ${completedCount}/${total} (page ${img.pageNumber})`);
            return extracted;
        });

        const batchResults = await Promise.all(batchPromises);
        for (const res of batchResults) {
            ocrBlocks.push(...res);
        }
    }

    const combined = [...textBlocks, ...ocrBlocks];
    const before = combined.length;
    const unique = deduplicateBlocks(combined);
    const duplicatesRemoved = before - unique.length;

    return {
        allBlocks: unique,
        textBlocks,
        ocrBlocks,
        duplicatesRemoved,
        imagesProcessed: images.length,
    };
}
