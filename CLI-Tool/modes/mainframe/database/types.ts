/**
 * Mainframe Database & VSAM Storage — Type Definitions
 * ----------------------------------------------------
 * Defines the schemas for execution history records stored in
 * the VSAM KSDS (Key-Sequenced Data Set) database.
 */

export type ExecutionType = "CODEBASE_PROJECT" | "ASSIGNMENT";
export type ExecutionStatus = "PASS" | "FAIL" | "SIMULATED" | "WARNING";
export type ExecutionEngineMode = "HERCULES_TK5" | "SIMULATED";

export interface StageTelemetry {
    stage: string;
    returnCode: string;
    status: "PASS" | "FAIL" | "SIMULATED" | "WARNING" | "FLUSHED";
    details?: string;
}

export interface CodebaseExecutionDetails {
    totalFiles: number;
    filesWithImports: number;
    genuineCount: number;
    pseudoCount: number;
    unknownCount: number;
    duplicateCount: number;
    duplicateFiles: Array<{ file: string; original: string; hash: string }>;
    technologies: Array<{
        technology: string;
        total: number;
        genuine: number;
        pseudo: number;
        unknown: number;
    }>;
    subScope?: string;
    targetSubpaths?: string[];
}

export interface AssignmentExecutionDetails {
    fileType: string;
    pageCount: number;
    problemStatement: string;
    detectedZIds: string[];
    zIdConsistent: boolean;
    requirementsMet: number;
    requirementsTotal: number;
    totalCodeBlocks: number;
    textBlocks: number;
    ocrBlocks: number;
    overallOptimizationGrade: string;
    suggestions: string[];
    codeBlocks: Array<{
        label: string;
        language: string;
        source: string;
        lines: number;
        hash: string;
    }>;
}

export interface ExecutionTelemetry {
    jobNames: Record<string, string>;
    datasetNames: Record<string, string>;
    stages: StageTelemetry[];
    integrityVerified: boolean;
    isFailureTest: boolean;
    durationMs?: number;
}

/**
 * Full detailed record for a Mainframe execution
 * (Codebase Project or Assignment).
 */
export interface MainframeExecutionRecord {
    /** 28-character VSAM KSDS primary key (e.g. CP-20261027-154923-88210000) */
    id: string;
    executionType: ExecutionType;
    timestamp: string;      // ISO 8601
    julianDate: string;     // YY.DDD (e.g. 26.300)
    formattedTime: string;  // HH:MM:SS
    targetName: string;     // Repo or Document name
    targetPath: string;     // Full absolute path
    scopeOrZId: string;     // Sub-scope or Student Z_ID
    verdict: string;        // Executive verdict / completion status
    grade: string;          // A+, A, B, C, D, F
    primaryScore: number;   // Authenticity % (Codebase) or Problem Match % (Assignment)
    recordCount: number;    // Records or Code lines/blocks
    returnCode: string;     // e.g. "RC=0000" or "RC=0012"
    status: ExecutionStatus;
    mode: ExecutionEngineMode;
    telemetry: ExecutionTelemetry;
    codebaseDetails?: CodebaseExecutionDetails;
    assignmentDetails?: AssignmentExecutionDetails;
    /** 160-byte fixed-width physical VSAM KSDS record */
    vsamRecord: string;
    /** Complete generated audit report (.txt) */
    reportContent?: string;
}

/** Filter parameters for querying execution history */
export interface VsamQueryFilter {
    executionType?: ExecutionType | "ALL";
    status?: ExecutionStatus | "ALL";
    searchKeyword?: string;
    startDate?: string;
    endDate?: string;
}

/** VSAM KSDS Cluster Metadata */
export interface VsamClusterMetadata {
    clusterName: string;
    dataComponentName: string;
    indexComponentName: string;
    volumeSerial: string;
    organization: "INDEXED (KSDS)";
    keyOffset: number;
    keyLength: number;
    recordSize: {
        average: number;
        maximum: number;
    };
    controlIntervalSize: number;
    totalRecords: number;
    highAllocatedRba: number;
    highUsedRba: number;
    lastUpdated: string;
}
