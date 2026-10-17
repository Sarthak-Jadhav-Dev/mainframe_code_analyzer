/**
 * Mainframe Codebase Auditor — JCL Job Templates
 * ------------------------------------------------
 * Generates all four JCL steps for the Hercules batch pipeline:
 *
 *   Step 1 (SORT)     — Sort flat file by CONTENT_HASH for dedup prep
 *   Step 2 (COBOL)    — Match-merge: imports vs. tech reference table
 *   Step 3 (REXX)     — Deduplicate, retag categories, finalize report
 *   Step 4 (COPY+CC)  — Record count check + conditional copy to output
 *
 * Port Reference (VERIFIED from HERCULES_PORTS_GUIDE.md):
 *   Card Reader (submission) : TCP port 3505
 *   HTTP Console (monitoring): HTTP port 8038
 *
 * JCL Formatting Rules (MVS/JES2):
 *   - Columns 1-72  : JCL statements
 *   - Column 1-2    : // (continuation prefix)
 *   - Column 3-10   : name field (8 chars, UPPERCASE)
 *   - Column 11     : space
 *   - Column 12+    : operation + operands
 *   - Must end with /* on a separate line
 *   - No tabs — spaces only
 */

/** Generate a random 4-char suffix for unique job names */
function jobSuffix(): string {
    return Math.floor(Math.random() * 9000 + 1000).toString();
}

/** Pad a name to exactly 8 uppercase characters */
function jclName(s: string): string {
    return s.toUpperCase().slice(0, 8).padEnd(8, " ");
}

export interface JclJobNames {
    uploadJob: string;
    sortJob: string;
    cobolJob: string;
    rexxJob: string;
    integrityJob: string;
    reportJob: string;
}

/** Generate a set of unique job names for this pipeline run */
export function generateJobNames(prefix: string = "AUD"): JclJobNames {
    const s = jobSuffix();
    return {
        uploadJob    : (prefix + "UP" + s).slice(0, 8),
        sortJob      : (prefix + "SO" + s).slice(0, 8),
        cobolJob     : (prefix + "CO" + s).slice(0, 8),
        rexxJob      : (prefix + "RX" + s).slice(0, 8),
        integrityJob : (prefix + "IT" + s).slice(0, 8),
        reportJob    : (prefix + "RP" + s).slice(0, 8),
    };
}

// ─── Step 1: Upload flat file data to MVS dataset ────────────────────────────

/**
 * JCL to upload the inline flat file data into an MVS sequential dataset
 * via IEBGENER. The flat file data is embedded as DD * inline.
 */
export function buildUploadJcl(
    jobName: string,
    datasetName: string,
    flatFileContent: string,
    lrecl: number = 80,
): string {
    const name = jclName(jobName);
    const blksize = lrecl * 10;

    return [
        `//${name} JOB (ACCT),'AUDIT-UPLOAD',CLASS=A,MSGCLASS=X`,
        `//STEP01   EXEC PGM=IEBGENER`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSUT1   DD *`,
        flatFileContent,
        `/*`,
        `//${" ".repeat(0)}SYSUT2   DD DSN=${datasetName},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            SPACE=(CYL,(1,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=${lrecl},BLKSIZE=${blksize})`,
        `//SYSIN    DD DUMMY`,
        `/*`,
        "",
    ].join("\n");
}

// ─── Step 2: Sort flat file by CONTENT_HASH ───────────────────────────────────

/**
 * JCL SORT job: sorts the uploaded flat file by the CONTENT_HASH field
 * (columns 51-58) to prepare for COBOL match-merge deduplication.
 */
export function buildSortJcl(
    jobName: string,
    inputDsn: string,
    outputDsn: string,
): string {
    const name = jclName(jobName);

    return [
        `//${name} JOB (ACCT),'AUDIT-SORT',CLASS=A,MSGCLASS=X`,
        `//STEP01   EXEC PGM=SORT`,
        `//SYSOUT   DD SYSOUT=*`,
        `//SORTIN   DD DSN=${inputDsn},DISP=SHR`,
        `//SORTOUT  DD DSN=${outputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            SPACE=(CYL,(1,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SYSIN    DD *`,
        `  SORT FIELDS=(41,10,CH,A,1,40,CH,A)`,
        `/*`,
        "",
    ].join("\n");
}

// ─── Step 3: COBOL match-merge ────────────────────────────────────────────────

/**
 * JCL to invoke the COBOL match-merge program (AUDCOBOL).
 *
 * The COBOL program:
 *   - Reads sorted flat file (AUDREC)
 *   - Reads the technology reference table (TECHREF) — embedded inline
 *   - Tags each record: GENUINE if hash appears >1 time, PSEUDO if only once
 *   - Writes matched output to AUDRPT
 *
 * The TECHREF inline data lists known tech names and their canonical categories.
 * Each TECHREF record: TECHNAME(10) CATEGORY(10) CANONICAL_FLAG(1) = 21 bytes
 */
export function buildCobolJcl(
    jobName: string,
    sortedInputDsn: string,
    outputDsn: string,
): string {
    const name = jclName(jobName);

    // Inline technology reference table — 21 bytes each, padded to 80
    const techRefRecords = [
        "REACT     FRONTEND-FW Y",
        "VUE       FRONTEND-FW Y",
        "ANGULAR   FRONTEND-FW Y",
        "SVELTE    FRONTEND-FW Y",
        "NEXTJS    META-FW     Y",
        "NUXT      META-FW     Y",
        "EXPRESS   BACKEND     Y",
        "FASTIFY   BACKEND     Y",
        "NESTJS    BACKEND     Y",
        "KOA       BACKEND     Y",
        "ELYSIA    BACKEND     Y",
        "AXIOS     HTTP-CLIENT Y",
        "GOT       HTTP-CLIENT Y",
        "NODEFETCH HTTP-CLIENT Y",
        "PRISMA    DATABASE    Y",
        "MONGOOSE  DATABASE    Y",
        "TYPEORM   DATABASE    Y",
        "DRIZZLE   DATABASE    Y",
        "JEST      TESTING     Y",
        "VITEST    TESTING     Y",
        "PLAYWRIGHT TESTING    Y",
        "VITE      BUILD       Y",
        "REDUX     STATE       Y",
        "ZUSTAND   STATE       Y",
        "PASSPORT  AUTH        Y",
        "NEXTAUTH  AUTH        Y",
        "AWSSDK    INFRA       Y",
        "FIREBASE  INFRA       Y",
        "SUPABASE  INFRA       Y",
    ].map((r) => r.padEnd(80)).join("\n");

    return [
        `//${name} JOB (ACCT),'AUDIT-COBOL',CLASS=A,MSGCLASS=X`,
        `//STEP01   EXEC PGM=AUDCOBOL`,
        `//STEPLIB  DD DSN=STUDENT.LOADLIB,DISP=SHR`,
        `//SYSPRINT DD SYSOUT=*`,
        `//AUDREC   DD DSN=${sortedInputDsn},DISP=SHR`,
        `//TECHREF  DD *`,
        techRefRecords,
        `/*`,
        `//AUDRPT   DD DSN=${outputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            SPACE=(CYL,(1,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SYSOUT   DD SYSOUT=*`,
        `/*`,
        "",
    ].join("\n");
}

// ─── Step 4: REXX deduplication + report finalization ─────────────────────────

/**
 * JCL to invoke the REXX exec AUDRXXX from STUDENT.EXEC.
 *
 * The REXX script:
 *   - Reads the COBOL output (AUDRPT)
 *   - Deduplicates records by CONTENT_HASH
 *   - Sorts by FILE_PATH (cols 1-40)
 *   - Recounts statistics per technology category
 *   - Writes the final report to AUDOUT
 */
export function buildRexxJcl(
    jobName: string,
    cobolOutputDsn: string,
    finalOutputDsn: string,
): string {
    const name = jclName(jobName);

    return [
        `//${name} JOB (ACCT),'AUDIT-REXX',CLASS=A,MSGCLASS=X`,
        `//STEP01   EXEC PGM=IKJEFT01`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSTSPRT DD SYSOUT=*`,
        `//SYSTSIN  DD *`,
        `  EXEC 'STUDENT.EXEC(AUDRXXX)'`,
        `/*`,
        `//AUDRPT   DD DSN=${cobolOutputDsn},DISP=SHR`,
        `//AUDOUT   DD DSN=${finalOutputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            SPACE=(CYL,(1,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `/*`,
        "",
    ].join("\n");
}

// ─── Step 4: Requirement 4 — IBM SORT Descending + Count Integrity Check ────

/**
 * Requirement 4 JCL:
 * - Copy input file to output file using IBM SORT utility in descending order
 * - Compare total record count before and after sort using AUDCOUNT REXX exec
 * - Keep output file ONLY if counts match (success path: COND=(0,NE,STEPCOMP))
 * - Print error message if counts do not match (failure path: COND=(0,EQ,STEPCOMP))
 * - Can simulate failure case by omitting records in SORT to test conditional error logic
 */
export function buildStep4IntegrityJcl(
    jobName: string,
    inputDsn: string,
    outputDsn: string,
    simulateFailure: boolean = false,
): string {
    const name = jclName(jobName);
    const sortSysin = simulateFailure
        ? [
            "  SORT FIELDS=(1,80,CH,D)",
            "  OMIT COND=(1,3,CH,EQ,C'===')",
          ].join("\n")
        : "  SORT FIELDS=(1,80,CH,D)";

    return [
        `//${name} JOB (ACCT),'REQ4-INTEGRITY',CLASS=A,MSGCLASS=X`,
        `//* STEP 1: SORT IN DESCENDING ORDER VIA IBM SORT`,
        `//STEP01   EXEC PGM=SORT`,
        `//SYSOUT   DD SYSOUT=*`,
        `//SORTIN   DD DSN=${inputDsn},DISP=SHR`,
        `//SORTOUT  DD DSN=&&SORTDESC,`,
        `//            DISP=(NEW,PASS),`,
        `//            SPACE=(CYL,(1,5)),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SYSIN    DD *`,
        sortSysin,
        `/*`,
        `//* STEP 2: COMPARE RECORD COUNTS (RC=0 IF MATCH, RC=12 IF MISMATCH)`,
        `//STEPCOMP EXEC PGM=IKJEFT01`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSTSPRT DD SYSOUT=*`,
        `//SYSEXEC  DD DSN=STUDENT.EXEC,DISP=SHR`,
        `//DS1      DD DSN=${inputDsn},DISP=SHR`,
        `//DS2      DD DSN=&&SORTDESC,DISP=SHR`,
        `//SYSTSIN  DD *`,
        `  EXEC 'STUDENT.EXEC(AUDCOUNT)'`,
        `/*`,
        `//* STEP 3: SUCCESS PATH — KEEP OUTPUT ONLY IF COUNTS MATCH (RC=0)`,
        `//STEPKEEP EXEC PGM=IEBGENER,COND=(0,NE,STEPCOMP)`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSUT1   DD DSN=&&SORTDESC,DISP=(OLD,DELETE)`,
        `//SYSUT2   DD DSN=${outputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            SPACE=(CYL,(1,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SYSIN    DD DUMMY`,
        `/*`,
        `//* STEP 4: FAILURE PATH — EMIT ERROR ONLY IF COUNTS MISMATCH (RC!=0)`,
        `//STEPERR  EXEC PGM=IKJEFT01,COND=(0,EQ,STEPCOMP)`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSTSPRT DD SYSOUT=*`,
        `//SYSTSIN  DD *`,
        `  WRITE *** CRITICAL ERROR: INTEGRITY CHECK FAILED - RECORD COUNT MISMATCH ***`,
        `  WRITE *** OUTPUT FILE DISCARDED PER AUDIT POLICY ***`,
        `/*`,
        "",
    ].join("\n");
}

// ─── Step 5: Report retrieval JCL (IEBGENER to SYSOUT) ───────────────────────

/**
 * JCL to copy the final report dataset to SYSOUT so it can be
 * captured from the system log via the HTTP console.
 */
export function buildReportJcl(
    jobName: string,
    reportDsn: string,
): string {
    const name = jclName(jobName);

    return [
        `//${name} JOB (ACCT),'AUDIT-REPORT',CLASS=A,MSGCLASS=X`,
        `//STEP01   EXEC PGM=IEBGENER`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSUT1   DD DSN=${reportDsn},DISP=SHR`,
        `//SYSUT2   DD SYSOUT=*`,
        `//SYSIN    DD DUMMY`,
        `/*`,
        "",
    ].join("\n");
}

// ─── Dataset name builder ─────────────────────────────────────────────────────

export function buildDatasetNames(prefix: string, suffix: string) {
    const ts = suffix.slice(-4); // e.g. "4823"
    return {
        inputDsn   : `${prefix}.AUDIT.INPUT.D${ts}`,
        sortedDsn  : `${prefix}.AUDIT.SORTED.D${ts}`,
        cobolOutDsn: `${prefix}.AUDIT.COBOL.D${ts}`,
        rexxOutDsn : `${prefix}.AUDIT.REXX.D${ts}`,
        finalDsn   : `${prefix}.AUDIT.FINAL.D${ts}`,
        reportDsn  : `${prefix}.AUDIT.REPORT.D${ts}`,
    };
}

