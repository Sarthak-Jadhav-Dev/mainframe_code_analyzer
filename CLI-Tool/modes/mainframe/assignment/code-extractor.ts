/**
 * Assignment Mode — Code Extractor (AI Vision / OCR)
 * ---------------------------------------------------
 * Sends document images to an AI vision model to extract code from screenshots.
 * Also merges and deduplicates code blocks extracted from the text parser.
 */

import crypto from "node:crypto";
import { generateText } from "ai";
import { getAgentModel } from "../../../ai/ai.config.ts";
import type { ParsedDocument, ExtractedCodeBlock, ExtractedImage } from "./types.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashCode(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex").slice(0, 8).toUpperCase();
}

function detectLanguageFromOcr(code: string): string {
    const upper = code.toUpperCase();
    if (/IDENTIFICATION DIVISION|PROCEDURE DIVISION|DATA DIVISION/.test(upper)) return "COBOL";
    if (/^\/\/[A-Z][A-Z0-9 ]*(JOB|EXEC|DD)/m.test(upper)) return "JCL";
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
    try {
        const model = await getAgentModel();

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
                                "You are an expert OCR assistant analyzing a document page screenshot.",
                                "Extract ALL code visible in this image.",
                                "Rules:",
                                "1. Extract every piece of code exactly as it appears — do NOT correct errors.",
                                "2. If multiple code blocks exist in the image, separate them with '--- CODE BLOCK ---'.",
                                "3. If there is NO code in the image, respond with exactly: NO_CODE",
                                "4. Do not add any explanation, just the raw code.",
                                "Respond now:",
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
            const code = rawCode.trim();
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
        // If vision model fails or image is too large, return empty
        return [];
    }
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
 * 2. OCR blocks from each embedded image (via AI vision)
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

    for (let i = 0; i < images.length; i++) {
        onProgress?.(i + 1, total, `Image ${i + 1}/${total} (page ${images[i]!.pageNumber})`);
        const extracted = await extractCodeFromImage(images[i]!, images[i]!.pageNumber, textBlocks.length + ocrBlocks.length);
        ocrBlocks.push(...extracted);
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
