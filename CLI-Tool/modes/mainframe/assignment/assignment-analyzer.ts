/**
 * Assignment Mode — Assignment Analyzer
 * ----------------------------------------
 * AI analysis engine that evaluates:
 *   1. Completion assessment (does code solve the problem statement?)
 *   2. Z_ID consistency check
 *   3. Code optimization analysis (time/space complexity, code smells)
 *   4. Improvement suggestions
 */

import { generateText } from "ai";
import { getAgentModel } from "../../../ai/ai.config.ts";
import type {
    ExtractedCodeBlock,
    AssignmentAnalysisResult,
    ZIdCheckResult,
    CodeOptimizationResult,
    ImprovementSuggestion,
    CompletionVerdict,
} from "./types.ts";

// ─── Z_ID Consistency Check ───────────────────────────────────────────────────

export function checkZIdConsistency(zIds: string[]): ZIdCheckResult {
    if (zIds.length === 0) {
        return {
            found: [],
            consistent: false,
            details: "No Z_IDs were detected in the document.",
        };
    }

    const unique = [...new Set(zIds)];
    const consistent = unique.length === 1;

    return {
        found: unique,
        consistent,
        details: consistent
            ? `All references use the same student ID: ${unique[0]}`
            : `Multiple different IDs found: ${unique.join(", ")}. This may indicate collaboration or a copy/paste error.`,
    };
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

interface AiAssignmentAnalysis {
    completionVerdict: CompletionVerdict;
    problemStatementMatchPercent: number;
    requirementsMet: number;
    requirementsTotal: number;
    overallOptimizationGrade: string;
    optimizationResults: CodeOptimizationResult[];
    suggestions: ImprovementSuggestion[];
}

function parseAiAnalysisJson(raw: string): AiAssignmentAnalysis | null {
    // Try to find JSON block inside the response
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) return null;
    try {
        return JSON.parse(jsonMatch[1]!) as AiAssignmentAnalysis;
    } catch {
        return null;
    }
}

function buildFallbackAnalysis(
    codeBlocks: ExtractedCodeBlock[],
    problemStatement: string,
): AiAssignmentAnalysis {
    const hasCode = codeBlocks.length > 0;
    const languages = [...new Set(codeBlocks.map((b) => b.language))];

    return {
        completionVerdict: hasCode ? "PARTIALLY_COMPLETED" : "INCOMPLETE",
        problemStatementMatchPercent: hasCode ? 50 : 0,
        requirementsMet: hasCode ? 1 : 0,
        requirementsTotal: 3,
        overallOptimizationGrade: hasCode ? "C" : "F",
        optimizationResults: codeBlocks.map((block, i) => ({
            codeBlockIndex: i,
            language: block.language,
            grade: "C",
            timeComplexity: "O(n) - Estimated",
            spaceComplexity: "O(n) - Estimated",
            codeSmells: 1,
            issues: ["Could not fully analyze — AI service unavailable. Manual review recommended."],
        })),
        suggestions: [
            {
                priority: "HIGH",
                category: "Review",
                description: "AI analysis service was unavailable. Please manually review the extracted code against the problem statement.",
            },
            {
                priority: "MEDIUM",
                category: "Code Quality",
                description: hasCode
                    ? `${codeBlocks.length} code block(s) detected in languages: ${languages.join(", ")}.`
                    : "No code blocks were detected in the document.",
            },
        ],
    };
}

async function runAiAnalysis(
    codeBlocks: ExtractedCodeBlock[],
    problemStatement: string,
): Promise<AiAssignmentAnalysis> {
    if (codeBlocks.length === 0) {
        return buildFallbackAnalysis(codeBlocks, problemStatement);
    }

    const codeSummary = codeBlocks
        .slice(0, 10) // limit to first 10 blocks to stay within context
        .map(
            (b, i) => `--- Code Block ${i + 1} [${b.language}] (source: ${b.source}) ---\n${b.code.slice(0, 1000)}`,
        )
        .join("\n\n");

    const prompt = [
        "You are a senior software engineering professor evaluating a student assignment submission.",
        "",
        "## Problem Statement",
        problemStatement,
        "",
        "## Extracted Code Blocks from Student Submission",
        codeSummary,
        "",
        "## Your Task",
        "Analyze the code blocks against the problem statement and respond with a JSON object in this EXACT structure:",
        "",
        "```json",
        JSON.stringify(
            {
                completionVerdict: "COMPLETED | PARTIALLY_COMPLETED | INCOMPLETE",
                problemStatementMatchPercent: "0-100 integer",
                requirementsMet: "integer",
                requirementsTotal: "integer",
                overallOptimizationGrade: "A+ | A | B+ | B | C+ | C | D | F",
                optimizationResults: [
                    {
                        codeBlockIndex: 0,
                        language: "string",
                        grade: "A-F grade",
                        timeComplexity: "e.g. O(n log n)",
                        spaceComplexity: "e.g. O(n)",
                        codeSmells: "integer count",
                        issues: ["array of specific issues found"],
                    },
                ],
                suggestions: [
                    {
                        priority: "HIGH | MEDIUM | LOW",
                        category: "string",
                        description: "string",
                    },
                ],
            },
            null,
            2,
        ),
        "```",
        "",
        "Be specific, fair, and constructive. Do not hallucinate code that is not present.",
    ].join("\n");

    try {
        const model = await getAgentModel();
        const { text } = await generateText({
            model,
            prompt,
            maxOutputTokens: 2500,
        });

        const parsed = parseAiAnalysisJson(text);
        if (parsed) {
            // Ensure all required fields are present
            return {
                completionVerdict: (parsed.completionVerdict as CompletionVerdict) || "PARTIALLY_COMPLETED",
                problemStatementMatchPercent: Number(parsed.problemStatementMatchPercent) || 0,
                requirementsMet: Number(parsed.requirementsMet) || 0,
                requirementsTotal: Number(parsed.requirementsTotal) || 1,
                overallOptimizationGrade: String(parsed.overallOptimizationGrade || "C"),
                optimizationResults: Array.isArray(parsed.optimizationResults) ? parsed.optimizationResults : [],
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
            };
        }
    } catch {
        // fall through to fallback
    }

    return buildFallbackAnalysis(codeBlocks, problemStatement);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full AI-powered assignment analysis.
 * Combines Z_ID check, completion assessment, optimization, and suggestions.
 */
export async function analyzeAssignment(
    codeBlocks: ExtractedCodeBlock[],
    zIds: string[],
    problemStatement: string,
    onStatus?: (msg: string) => void,
): Promise<AssignmentAnalysisResult> {
    onStatus?.("Checking Z_ID consistency...");
    const zIdCheck = checkZIdConsistency(zIds);

    onStatus?.(`Running AI analysis on ${codeBlocks.length} code block(s)...`);
    const aiResult = await runAiAnalysis(codeBlocks, problemStatement);

    return {
        completionVerdict: aiResult.completionVerdict,
        problemStatementMatchPercent: aiResult.problemStatementMatchPercent,
        requirementsMet: aiResult.requirementsMet,
        requirementsTotal: aiResult.requirementsTotal,
        zIdCheck,
        optimizationResults: aiResult.optimizationResults,
        overallOptimizationGrade: aiResult.overallOptimizationGrade,
        suggestions: aiResult.suggestions,
        allCodeBlocks: codeBlocks,
    };
}
