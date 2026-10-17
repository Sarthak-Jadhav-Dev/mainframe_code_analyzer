/**
 * Mainframe Codebase Auditor — Type Definitions
 * -----------------------------------------------
 * These types define the data structures used throughout the
 * Plotoris preprocessing pipeline before submission to Hercules.
 */

/** Usage classification for a technology found in a file */
export type UsageType = "GENUINE" | "PSEUDO" | "UNKNOWN";

/** A single detected technology import in a source file */
export interface TechImport {
    techName: string;       // e.g. "react", "express", "axios"
    category: string;       // e.g. "frontend-framework", "backend", "http-client"
    importLine: string;     // The raw import line e.g. "import React from 'react'"
    isUsedInBody?: boolean; // Static analysis heuristic: symbol invoked in body
}

/**
 * One record for the fixed-width flat file sent to the mainframe.
 * Represents one technology detection in one file.
 *
 * 80-byte fixed-width layout (COBOL-compatible):
 *   Cols  1-40: FILE_PATH    (relative path, space-padded)
 *   Cols 41-50: TECH_NAME    (technology name, space-padded)
 *   Cols 51-58: CONTENT_HASH (first 8 chars of MD5, uppercase hex)
 *   Cols 59-68: USAGE_TYPE   (GENUINE | PSEUDO | UNKNOWN, space-padded)
 *   Cols 69-72: IMPORT_COUNT (4-digit integer, zero-padded)
 *   Cols 73-80: RESERVED     (spaces)
 */
export interface FlatFileRecord {
    filePath: string;       // max 40 chars, relative to repo root
    fullPath?: string;      // untruncated relative path for reliable matching
    techName: string;       // max 10 chars
    contentHash: string;    // 8-char hex (first 8 chars of MD5)
    usageType: UsageType;   // max 10 chars
    importCount: number;    // 0000-9999
}

/** Result of scanning a single source file */
export interface ScannedFile {
    relativePath: string;
    absolutePath: string;
    contentHash: string;    // 8-char hex
    sizeBytes: number;
    extension: string;
    imports: TechImport[];
    importCount: number;
    /** AI judgment — set after AI call, null if not yet evaluated */
    aiUsageJudgment?: UsageType;
}

/** Overall result of scanning the entire repository */
export interface ScanResult {
    repoPath: string;
    scannedAt: Date;
    totalFiles: number;
    filesWithImports: number;
    records: FlatFileRecord[];
    scannedFiles: ScannedFile[];
}

/** Configuration for the mainframe pipeline */
export interface MainframeConfig {
    host: string;
    cardReaderPort: number;
    httpPort: number;
    datasetPrefix: string;
    pollIntervalMs: number;
    pollMaxAttempts: number;
    mode: "hercules" | "simulated" | "auto";
}

export const defaultMainframeConfig = (): MainframeConfig => ({
    host: process.env.TK5_HOST || "127.0.0.1",
    cardReaderPort: parseInt(process.env.TK5_CARD_READER_PORT || "3505"),
    httpPort: parseInt(process.env.TK5_HTTP_PORT || "8038"),
    datasetPrefix: process.env.TK5_DATASET_PREFIX || "STUDENT",
    pollIntervalMs: parseInt(process.env.JOB_POLL_INTERVAL_MS || "2000"),
    pollMaxAttempts: parseInt(process.env.JOB_POLL_MAX_ATTEMPTS || "30"),
    mode: (process.env.MAINFRAME_MODE as MainframeConfig["mode"]) || "auto",
});

/** Result of submitting and polling a JCL job */
export interface JobResult {
    success: boolean;
    jobName: string;
    returnCode?: number;
    attempts?: number;
    totalTimeMs?: number;
    error?: string;
    syslog?: string;
}
