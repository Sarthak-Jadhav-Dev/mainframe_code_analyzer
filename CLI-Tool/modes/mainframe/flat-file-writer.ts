/**
 * Mainframe Codebase Auditor — Fixed-Width Flat File Writer
 * ----------------------------------------------------------
 * Serializes scan records into an 80-byte fixed-width flat file
 * compatible with IBM MVS COBOL (RECFM=FB, LRECL=80).
 *
 * Record layout (columns 1-based, as in COBOL PIC clauses):
 *   01 AUDIT-RECORD.
 *      05 AR-FILE-PATH    PIC X(40).   COLS  1-40
 *      05 AR-TECH-NAME    PIC X(10).   COLS 41-50
 *      05 AR-CONTENT-HASH PIC X(8).    COLS 51-58
 *      05 AR-USAGE-TYPE   PIC X(10).   COLS 59-68
 *      05 AR-IMPORT-COUNT PIC 9(4).    COLS 69-72
 *      05 AR-RESERVED     PIC X(8).    COLS 73-80
 *
 * Total: 40 + 10 + 8 + 10 + 4 + 8 = 80 bytes per record ✓
 */

import fs from "node:fs";
import path from "node:path";
import type { FlatFileRecord, ScanResult } from "./types.ts";

const LRECL = 80;

/** Left-justify a string in a field of exactly `width` characters */
function leftPad(s: string, width: number): string {
    const trimmed = s.slice(0, width); // truncate if too long
    return trimmed.padEnd(width, " "); // pad with spaces if too short
}

/** Right-justify a numeric value in a field of exactly `width` digits (zero-padded) */
function numericField(n: number, width: number): string {
    const s = Math.floor(Math.abs(n)).toString();
    if (s.length >= width) return s.slice(0, width);
    return s.padStart(width, "0");
}

/** Serialize a single FlatFileRecord to an 80-byte string */
export function serializeRecord(record: FlatFileRecord): string {
    const filePath     = leftPad(record.filePath.toUpperCase(), 40);   // cols 1-40
    const techName     = leftPad(record.techName.toUpperCase(), 10);   // cols 41-50
    const contentHash  = leftPad(record.contentHash.toUpperCase(), 8); // cols 51-58
    const usageType    = leftPad(record.usageType, 10);                // cols 59-68
    const importCount  = numericField(record.importCount, 4);           // cols 69-72
    const reserved     = " ".repeat(8);                                 // cols 73-80

    const row = `${filePath}${techName}${contentHash}${usageType}${importCount}${reserved}`;

    // Guard: every row must be exactly 80 bytes (ASCII)
    if (row.length !== LRECL) {
        throw new Error(
            `Record serialization error: expected ${LRECL} bytes, got ${row.length}\n` +
            `  filePath="${filePath}" (${filePath.length})\n` +
            `  techName="${techName}" (${techName.length})\n` +
            `  contentHash="${contentHash}" (${contentHash.length})\n` +
            `  usageType="${usageType}" (${usageType.length})\n` +
            `  importCount="${importCount}" (${importCount.length})\n`
        );
    }

    return row;
}

/**
 * Write a complete flat file from a scan result.
 *
 * The file uses Unix line endings (LF only) to avoid CRLF confusion.
 * MVS expects each record as exactly LRECL bytes, delimited by \n.
 *
 * A header record is prepended (all uppercase, col 1 = "H"):
 *   HHEADER  AUDIT     FLATFILE  YYYYMMDD  HHMISS  NNNNNNN
 *
 * Records are separated by LF (\n) — the JCL `/*` end-of-data
 * marker is appended by the Hercules client, NOT here.
 */
export function writeFlatFile(
    scanResult: ScanResult,
    outputPath: string,
): { path: string; recordCount: number; sizeBytes: number } {
    const records = scanResult.records;

    const lines: string[] = [];

    // Header record
    const now = scanResult.scannedAt;
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const countStr = numericField(records.length, 7);
    const header = `H${"AUDIT FLAT FILE".padEnd(39)} ${date}  ${time}  ${countStr}`;
    lines.push(leftPad(header, LRECL));

    // Data records
    for (const record of records) {
        lines.push(serializeRecord(record));
    }

    const content = lines.join("\n") + "\n";

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, "ascii");

    const sizeBytes = fs.statSync(outputPath).size;
    return { path: outputPath, recordCount: records.length, sizeBytes };
}

/**
 * Read a flat file back into FlatFileRecord objects.
 * Used for validation and debugging.
 */
export function readFlatFile(filePath: string): FlatFileRecord[] {
    const content = fs.readFileSync(filePath, "ascii");
    const lines = content.split("\n").filter((l) => l.length === LRECL);
    const records: FlatFileRecord[] = [];

    for (const line of lines) {
        // Skip header records
        if (line.charAt(0) === "H") continue;

        records.push({
            filePath: line.slice(0, 40).trimEnd(),
            techName: line.slice(40, 50).trimEnd(),
            contentHash: line.slice(50, 58).trimEnd(),
            usageType: line.slice(58, 68).trimEnd() as FlatFileRecord["usageType"],
            importCount: parseInt(line.slice(68, 72), 10) || 0,
        });
    }

    return records;
}

/**
 * Return the flat file content as a string for embedding directly in JCL
 * as DD * inline data. Each line is exactly 80 characters.
 */
export function flatFileToInlineData(scanResult: ScanResult): string {
    const lines: string[] = [];

    const now = scanResult.scannedAt;
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const countStr = numericField(scanResult.records.length, 7);
    const header = leftPad(`HAUDIT FLAT FILE  ${date}  ${time}  ${countStr}`, LRECL);
    lines.push(header);

    for (const record of scanResult.records) {
        lines.push(serializeRecord(record));
    }

    return lines.join("\n");
}
