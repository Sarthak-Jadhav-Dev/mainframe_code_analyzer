/**
 * Mainframe Database & VSAM Storage — VSAM Record Serializer
 * -----------------------------------------------------------
 * Serializes and deserializes execution history into an authentic
 * 160-byte fixed-width VSAM KSDS (Key-Sequenced Data Set) layout.
 *
 * VSAM KSDS Layout (160 Bytes):
 *   Cols   1-28: VSAM_KEY      (Primary Key: TYPE-YYYYMMDD-HHMMSS-RAND)
 *   Cols  29-32: EXEC_TYPE     (CODE | ASGN)
 *   Cols  33-40: JULIAN_DATE   (YY.DDD space-padded, e.g. "26.300  ")
 *   Cols  41-48: TIME_HMS      (HH:MM:SS)
 *   Cols  49-56: RET_CODE      (e.g. "RC=0000 ")
 *   Cols  57-60: GRADE         (e.g. "A+  ", "B   ")
 *   Cols  61-64: SCORE         (4-digit zero-padded percent, e.g. "0088")
 *   Cols  65-72: REC_COUNT     (8-digit zero-padded integer)
 *   Cols  73-80: STATUS        (PASS     | FAIL     | SIMUL    )
 *   Cols  81-120: TARGET_NAME  (Repo or Document name, space-padded)
 *   Cols 121-140: SCOPE_OR_ZID (Scope or Student Z_ID, space-padded)
 *   Cols 141-160: RESERVED     (20 spaces for future IDCAMS expansion)
 *
 * Total: 28 + 4 + 8 + 8 + 8 + 4 + 4 + 8 + 8 + 40 + 20 + 20 = 160 Bytes
 */

import type { ExecutionType, MainframeExecutionRecord } from "./types.ts";

export const VSAM_RECORD_LENGTH = 160;
export const VSAM_KEY_LENGTH = 28;

function padEnd(s: string, len: number): string {
    const trimmed = (s || "").slice(0, len);
    return trimmed.padEnd(len, " ");
}

function padStartDigits(n: number, len: number): string {
    const s = Math.floor(Math.abs(n || 0)).toString();
    if (s.length >= len) return s.slice(0, len);
    return s.padStart(len, "0");
}

/** Convert a Date to IBM MVS Julian format: YY.DDD (e.g. 26.300) */
export function toJulianDate(d: Date): string {
    const year = d.getFullYear() % 100;
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    return `${String(year).padStart(2, "0")}.${String(dayOfYear).padStart(3, "0")}`;
}

/** Generate a 28-character unique VSAM KSDS Primary Key */
export function generateVsamKey(type: ExecutionType, d: Date): string {
    const typePrefix = type === "CODEBASE_PROJECT" ? "CP" : "AS";
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD (8)
    const timeStr = d.toTimeString().slice(0, 8).replace(/:/g, ""); // HHMMSS (6)
    const rand = Math.floor(Math.random() * 90000000 + 10000000).toString(); // 8 digits
    // CP-YYYYMMDD-HHMMSS-XXXXXXXX -> 2 + 1 + 8 + 1 + 6 + 1 + 8 = 27 chars -> pad to 28
    const raw = `${typePrefix}-${dateStr}-${timeStr}-${rand}`;
    return padEnd(raw, VSAM_KEY_LENGTH);
}

/** Serialize a MainframeExecutionRecord into an exact 160-byte VSAM record */
export function serializeToVsamRecord(record: {
    id: string;
    executionType: ExecutionType;
    julianDate: string;
    formattedTime: string;
    returnCode: string;
    grade: string;
    primaryScore: number;
    recordCount: number;
    status: string;
    targetName: string;
    scopeOrZId: string;
}): string {
    const key       = padEnd(record.id.toUpperCase(), 28);
    const execType  = padEnd(record.executionType === "CODEBASE_PROJECT" ? "CODE" : "ASGN", 4);
    const julian    = padEnd(record.julianDate, 8);
    const time      = padEnd(record.formattedTime, 8);
    const retCode   = padEnd(record.returnCode.toUpperCase(), 8);
    const grade     = padEnd(record.grade.toUpperCase(), 4);
    const score     = padStartDigits(record.primaryScore, 4);
    const recCount  = padStartDigits(record.recordCount, 8);
    const status    = padEnd(record.status.toUpperCase(), 8);
    const target    = padEnd(record.targetName.toUpperCase().replace(/[^A-Z0-9._-]/g, "_"), 40);
    const scopeOrId = padEnd((record.scopeOrZId || "").toUpperCase().replace(/[^A-Z0-9._-]/g, "_"), 20);
    const reserved  = " ".repeat(20);

    const row = `${key}${execType}${julian}${time}${retCode}${grade}${score}${recCount}${status}${target}${scopeOrId}${reserved}`;

    if (row.length !== VSAM_RECORD_LENGTH) {
        throw new Error(
            `VSAM serialization error: expected ${VSAM_RECORD_LENGTH} bytes, got ${row.length}`
        );
    }

    return row;
}

/** Parse a 160-byte VSAM KSDS record back into fields */
export function deserializeVsamRecord(line: string): Partial<MainframeExecutionRecord> {
    if (!line || line.length < 80) return {};

    const key       = line.slice(0, 28).trim();
    const typeCode  = line.slice(28, 32).trim();
    const julian    = line.slice(32, 40).trim();
    const time      = line.slice(40, 48).trim();
    const retCode   = line.slice(48, 56).trim();
    const grade     = line.slice(56, 60).trim();
    const score     = parseInt(line.slice(60, 64), 10) || 0;
    const recCount  = parseInt(line.slice(64, 72), 10) || 0;
    const status    = line.slice(72, 80).trim();
    const target    = line.slice(80, 120).trim();
    const scopeOrId = line.slice(120, 140).trim();

    return {
        id: key,
        executionType: typeCode === "CODE" ? "CODEBASE_PROJECT" : "ASSIGNMENT",
        julianDate: julian,
        formattedTime: time,
        returnCode: retCode || "RC=0000",
        grade: grade || "N/A",
        primaryScore: score,
        recordCount: recCount,
        status: (status as any) || "PASS",
        targetName: target,
        scopeOrZId: scopeOrId,
        vsamRecord: line.padEnd(VSAM_RECORD_LENGTH, " ").slice(0, VSAM_RECORD_LENGTH),
    };
}
