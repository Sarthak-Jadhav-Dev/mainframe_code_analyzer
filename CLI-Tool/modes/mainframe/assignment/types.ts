/**
 * Assignment Mode — Type Definitions
 * -----------------------------------
 * Types for the Assignment Audit pipeline:
 *   Document → Code Extraction → AI Analysis → TK5 Pipeline → Report
 */

// ─── Extracted Content ────────────────────────────────────────────────────────

/** A code block extracted from a document page or screenshot */
export interface ExtractedCodeBlock {
    /** Unique index within the document */
    index: number;
    /** Programming language detected (e.g. "COBOL", "Python", "Java") */
    language: string;
    /** Raw code text */
    code: string;
    /** Source of extraction: text from page body or OCR from screenshot */
    source: "text" | "ocr";
    /** Page number within the document (1-based) */
    pageNumber: number;
    /** MD5 hash of the code content (first 8 chars) for deduplication */
    contentHash: string;
}

/** An image extracted from a document page */
export interface ExtractedImage {
    /** Page number the image came from */
    pageNumber: number;
    /** Base64-encoded image data */
    data: string;
    /** MIME type, e.g. "image/png" */
    mimeType: string;
}

/** Full result of parsing a document */
export interface ParsedDocument {
    /** Original file path */
    filePath: string;
    /** File type (pdf or docx) */
    fileType: "pdf" | "docx";
    /** Full extracted plain text */
    fullText: string;
    /** All text code blocks found */
    textCodeBlocks: ExtractedCodeBlock[];
    /** All images found in the document */
    images: ExtractedImage[];
    /** Z_IDs detected in the document text (e.g. "Z00123456") */
    zIds: string[];
    /** Total number of pages */
    pageCount: number;
}

// ─── Analysis Results ─────────────────────────────────────────────────────────

/** Overall completion verdict */
export type CompletionVerdict = "COMPLETED" | "PARTIALLY_COMPLETED" | "INCOMPLETE";

/** Z_ID consistency result */
export interface ZIdCheckResult {
    /** All unique Z_IDs found in the document */
    found: string[];
    /** Whether all IDs are consistent (same ID throughout) */
    consistent: boolean;
    /** Details about discrepancies if any */
    details: string;
}

/** Per-code-block optimization result */
export interface CodeOptimizationResult {
    /** Index of the code block being analyzed */
    codeBlockIndex: number;
    /** Detected language */
    language: string;
    /** Letter grade (A, B+, C, etc.) */
    grade: string;
    /** Estimated time complexity */
    timeComplexity: string;
    /** Estimated space complexity */
    spaceComplexity: string;
    /** Number of code smells detected */
    codeSmells: number;
    /** Specific issues found */
    issues: string[];
}

/** A single improvement suggestion */
export interface ImprovementSuggestion {
    priority: "HIGH" | "MEDIUM" | "LOW";
    category: string;
    description: string;
}

/** Full AI analysis result */
export interface AssignmentAnalysisResult {
    /** Completion assessment */
    completionVerdict: CompletionVerdict;
    /** How well the code matches the problem statement (0–100) */
    problemStatementMatchPercent: number;
    /** Plagiarism percentage detected (0–100), 0 = original, 100 = copied */
    plagiarismPercentage?: number;
    /** Number of requirements that appear to be met */
    requirementsMet: number;
    /** Total number of requirements inferred from problem statement */
    requirementsTotal: number;
    /** Z_ID check */
    zIdCheck: ZIdCheckResult;
    /** Code optimization results per block */
    optimizationResults: CodeOptimizationResult[];
    /** Overall optimization grade */
    overallOptimizationGrade: string;
    /** List of improvement suggestions */
    suggestions: ImprovementSuggestion[];
    /** All extracted code blocks (text + OCR combined) */
    allCodeBlocks: ExtractedCodeBlock[];
}

// ─── TK5 Pipeline Record ──────────────────────────────────────────────────────

/**
 * 80-byte fixed-width record for each code block sent through TK5.
 * Maps code structure to the same COBOL-compatible flat file format.
 *
 *   Cols  1-40: CODE_LABEL   (block label, e.g. "BLOCK_001_PYTHON")
 *   Cols 41-50: LANG_NAME    (programming language)
 *   Cols 51-58: CONTENT_HASH (8-char MD5 prefix)
 *   Cols 59-68: BLOCK_TYPE   (TEXT | OCR | UNKNOWN)
 *   Cols 69-72: LINE_COUNT   (4-digit count of code lines)
 *   Cols 73-80: RESERVED     (spaces)
 */
export interface AssignmentFlatRecord {
    codeLabel: string;      // max 40 chars
    langName: string;       // max 10 chars
    contentHash: string;    // 8-char hex
    blockType: "TEXT" | "OCR" | "UNKNOWN";
    lineCount: number;      // 0000-9999
}

// ─── TK5 Pipeline Verification ───────────────────────────────────────────────

export interface TK5StageResult {
    stage: string;
    returnCode: number | string;
    status: "PASS" | "FAIL" | "SIMULATED";
    details: string;
}

export interface TK5VerificationResult {
    stages: TK5StageResult[];
    duplicatesFound: number;
    integrityVerified: boolean;
    jobNames?: Record<string, string>;
    datasetNames?: Record<string, string>;
}

// ─── Final Report ─────────────────────────────────────────────────────────────

export interface AssignmentAuditReport {
    /** Document information */
    documentPath: string;
    fileType: "pdf" | "docx";
    pageCount: number;
    auditTimestamp: Date;
    /** Problem statement provided by user */
    problemStatement: string;
    /** Extracted content */
    zIds: string[];
    totalCodeBlocks: number;
    /** Analysis results */
    analysis: AssignmentAnalysisResult;
    /** TK5 pipeline verification */
    tk5Verification: TK5VerificationResult;
}
