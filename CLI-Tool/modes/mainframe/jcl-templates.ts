/**
 * Mainframe Codebase Auditor - JCL Job Templates
 * ------------------------------------------------
 * Generates all JCL steps for the Hercules batch pipeline:
 *
 *   Upload            - IEBGENER inline flat file to MVS dataset
 *   Requirement 1     - JCL SORT by TECH_NAME for COBOL match-merge
 *   Requirement 2     - COBOL match-merge (AUDCOBOL vs TECHREF)
 *   Requirement 3     - REXX deduplication & primary-key sort (AUDRXXX)
 *   Requirement 4     - IBM SORT Descending + Count Integrity Check (AUDCOUNT)
 *   Report Retrieval  - IEBGENER copy to SYSOUT
 *
 * Verified TK5 Compatibility:
 *   - Device allocation: UNIT=3390,VOL=SER=WORK01
 *   - DFSORT library: SYS1.SORTLIB + SORTWK01..03
 *   - Security: USER=HERC01,PASSWORD=CUL8TR
 *   - Line length strictly <= 71 characters (MVS column limit)
 *   - Output CLASS=A, MSGCLASS=A for automatic capture via PRINTER1 (prt00e.txt)
 */

/** Generate a random 4-char suffix for unique job names */
function jobSuffix(): string {
    return Math.floor(Math.random() * 9000 + 1000).toString();
}

/** Pad a name to exactly 8 uppercase characters */
function jclName(s: string): string {
    return s.toUpperCase().slice(0, 8).padEnd(8, " ");
}

/**
 * Standard JOB card formatted cleanly across 2 lines to strictly
 * remain within MVS column limits (<= 71 characters).
 */
function makeJobCard(
    name: string,
    desc: string,
    user: string = "HERC01",
    password: string = "CUL8TR",
): string[] {
    const pwdPart = password ? `,PASSWORD=${password}` : "";
    return [
        `//${name} JOB (ACCT),'${desc}',`,
        `//         CLASS=A,MSGCLASS=A,USER=${user}${pwdPart}`,
    ];
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

// --- Step 1: Upload flat file data to MVS dataset ----------------------------

/**
 * JCL to upload the inline flat file data into an MVS sequential dataset
 * via IEBGENER on 3390 public DASD (WORK01).
 */
export function buildUploadJcl(
    jobName: string,
    datasetName: string,
    flatFileContent: string,
    lrecl: number = 80,
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    const name = jclName(jobName);
    const blksize = lrecl * 10;

    return [
        ...makeJobCard(name, "AUDIT-UPLOAD", user, password),
        `//STEP01   EXEC PGM=IEBGENER`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSIN    DD DUMMY`,
        `//SYSUT2   DD DSN=${datasetName},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            UNIT=3390,VOL=SER=WORK01,`,
        `//            SPACE=(TRK,(5,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=${lrecl},BLKSIZE=${blksize})`,
        `//SYSUT1   DD *`,
        flatFileContent,
        `/*`,
        "",
    ].join("\n");
}

// --- Step 2: Sort flat file by TECH_NAME -------------------------------------

/**
 * JCL SORT job: sorts the uploaded flat file by TECH_NAME (cols 41-50)
 * to prepare for COBOL match-merge against TECHREF.
 */
export function buildSortJcl(
    jobName: string,
    inputDsn: string,
    outputDsn: string,
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    const name = jclName(jobName);

    return [
        ...makeJobCard(name, "AUDIT-SORT", user, password),
        `//STEP01   EXEC PGM=SORT`,
        `//SORTLIB  DD DSN=SYS1.SORTLIB,DISP=SHR`,
        `//SYSOUT   DD SYSOUT=*`,
        `//SORTIN   DD DSN=${inputDsn},DISP=SHR`,
        `//SORTOUT  DD DSN=${outputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            UNIT=3390,VOL=SER=WORK01,`,
        `//            SPACE=(TRK,(5,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SORTWK01 DD UNIT=3390,SPACE=(CYL,(1,1))`,
        `//SORTWK02 DD UNIT=3390,SPACE=(CYL,(1,1))`,
        `//SORTWK03 DD UNIT=3390,SPACE=(CYL,(1,1))`,
        `//SYSIN    DD *`,
        `  SORT FIELDS=(41,10,CH,A,1,40,CH,A)`,
        `  RECORD LENGTH=80,TYPE=F`,
        `/*`,
        "",
    ].join("\n");
}

// --- Step 3: COBOL match-merge ------------------------------------------------

/**
 * JCL to invoke the COBOL match-merge program (AUDCOBOL).
 * Uses strictly alphabetically sorted reference records matching TECHREF.txt.
 */
export function buildCobolJcl(
    jobName: string,
    sortedInputDsn: string,
    outputDsn: string,
    prefix: string = "HERC01",
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    const name = jclName(jobName);

    // Alphabetically sorted technology reference table - exactly matching TECHREF.txt
    // Format: 10 chars tech name + 10 chars category + 1 char canonical flag ('Y')
    const techRefRecords = [
        "ANGULAR   FRONTEND-FW Y",
        "AWSSDK    INFRA       Y",
        "AXIOS     HTTP-CLIENT Y",
        "DRIZZLE   DATABASE    Y",
        "ELYSIA    BACKEND     Y",
        "EXPRESS   BACKEND     Y",
        "FASTIFY   BACKEND     Y",
        "FIREBASE  INFRA       Y",
        "GOT       HTTP-CLIENT Y",
        "JEST      TESTING     Y",
        "KOA       BACKEND     Y",
        "MONGOOSE  DATABASE    Y",
        "NESTJS    BACKEND     Y",
        "NEXTAUTH  AUTH        Y",
        "NEXTJS    META-FW     Y",
        "NODEFETCH HTTP-CLIENT Y",
        "NUXT      META-FW     Y",
        "PASSPORT  AUTH        Y",
        "PLAYWRIGHTTESTING     Y",
        "PRISMA    DATABASE    Y",
        "REACT     FRONTEND-FW Y",
        "REDUX     STATE       Y",
        "SUPABASE  INFRA       Y",
        "SVELTE    FRONTEND-FW Y",
        "TAILWIND  STYLING     Y",
        "TYPEORM   DATABASE    Y",
        "VITE      BUILD       Y",
        "VITEST    TESTING     Y",
        "VUE       FRONTEND-FW Y",
        "ZUSTAND   STATE       Y",
    ].map((r) => r.padEnd(80)).join("\n");

    return [
        ...makeJobCard(name, "AUDIT-COBOL", user, password),
        `//STEP01   EXEC PGM=AUDCOBOL`,
        `//STEPLIB  DD DSN=${prefix}.LOADLIB,DISP=SHR`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSOUT   DD SYSOUT=*`,
        `//AUDREC   DD DSN=${sortedInputDsn},DISP=SHR`,
        `//AUDRPT   DD DSN=${outputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            UNIT=3390,VOL=SER=WORK01,`,
        `//            SPACE=(TRK,(5,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//TECHREF  DD *`,
        techRefRecords,
        `/*`,
        "",
    ].join("\n");
}

// --- Step 4: REXX deduplication + report finalization -------------------------

/**
 * JCL to invoke the REXX exec AUDRXXX from EXEC PDS.
 */
export function buildRexxJcl(
    jobName: string,
    cobolOutputDsn: string,
    finalOutputDsn: string,
    prefix: string = "HERC01",
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    const name = jclName(jobName);

    return [
        ...makeJobCard(name, "AUDIT-REXX", user, password),
        `//STEP01   EXEC PGM=IKJEFT01`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSTSPRT DD SYSOUT=*`,
        `//SYSEXEC  DD DSN=${prefix}.EXEC,DISP=SHR`,
        `//AUDRPT   DD DSN=${cobolOutputDsn},DISP=SHR`,
        `//AUDOUT   DD DSN=${finalOutputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            UNIT=3390,VOL=SER=WORK01,`,
        `//            SPACE=(TRK,(5,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SYSTSIN  DD *`,
        `  EXEC '${prefix}.EXEC(AUDRXXX)'`,
        `/*`,
        "",
    ].join("\n");
}

// --- Requirement 4: IBM SORT Descending + Count Integrity Check ---------------

/**
 * Requirement 4 JCL:
 * - Copy input file to output file using IBM SORT utility in descending order
 * - Compare total record count before and after sort using AUDCOUNT REXX exec
 * - Keep output file ONLY if counts match (success path: COND=(0,NE,STEPCOMP))
 * - Print error message if counts do not match (failure path: COND=(0,EQ,STEPCOMP))
 */
export function buildStep4IntegrityJcl(
    jobName: string,
    inputDsn: string,
    outputDsn: string,
    simulateFailure: boolean = false,
    prefix: string = "HERC01",
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    const name = jclName(jobName);
    const sortSysin = simulateFailure
        ? [
            "  SORT FIELDS=(1,80,CH,D)",
            "  OMIT COND=(1,3,CH,EQ,C'===')",
          ].join("\n")
        : "  SORT FIELDS=(1,80,CH,D)";

    return [
        ...makeJobCard(name, "REQ4-INTEGRITY", user, password),
        `//* STEP 1: SORT IN DESCENDING ORDER VIA IBM SORT`,
        `//STEP01   EXEC PGM=SORT`,
        `//SORTLIB  DD DSN=SYS1.SORTLIB,DISP=SHR`,
        `//SYSOUT   DD SYSOUT=*`,
        `//SORTIN   DD DSN=${inputDsn},DISP=SHR`,
        `//SORTOUT  DD DSN=&&SORTDESC,`,
        `//            DISP=(NEW,PASS),`,
        `//            UNIT=3390,SPACE=(TRK,(5,5)),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SORTWK01 DD UNIT=3390,SPACE=(CYL,(1,1))`,
        `//SORTWK02 DD UNIT=3390,SPACE=(CYL,(1,1))`,
        `//SORTWK03 DD UNIT=3390,SPACE=(CYL,(1,1))`,
        `//SYSIN    DD *`,
        sortSysin,
        `  RECORD LENGTH=80,TYPE=F`,
        `/*`,
        `//* STEP 2: COMPARE RECORD COUNTS (RC=0 IF MATCH, RC=12 IF MISMATCH)`,
        `//STEPCOMP EXEC PGM=IKJEFT01`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSTSPRT DD SYSOUT=*`,
        `//SYSEXEC  DD DSN=${prefix}.EXEC,DISP=SHR`,
        `//DS1      DD DSN=${inputDsn},DISP=SHR`,
        `//DS2      DD DSN=&&SORTDESC,DISP=SHR`,
        `//SYSTSIN  DD *`,
        `  EXEC '${prefix}.EXEC(AUDCOUNT)'`,
        `/*`,
        `//* STEP 3: SUCCESS PATH - KEEP OUTPUT ONLY IF COUNTS MATCH (RC=0)`,
        `//STEPKEEP EXEC PGM=IEBGENER,COND=(0,NE,STEPCOMP)`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSUT1   DD DSN=&&SORTDESC,DISP=(OLD,DELETE)`,
        `//SYSUT2   DD DSN=${outputDsn},`,
        `//            DISP=(NEW,CATLG,DELETE),`,
        `//            UNIT=3390,VOL=SER=WORK01,`,
        `//            SPACE=(TRK,(5,5),RLSE),`,
        `//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)`,
        `//SYSIN    DD DUMMY`,
        `//* STEP 4: FAILURE PATH - EMIT ERROR ONLY IF COUNTS MISMATCH (RC!=0)`,
        `//STEPERR  EXEC PGM=IKJEFT01,COND=(0,EQ,STEPCOMP)`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSTSPRT DD SYSOUT=*`,
        `//SYSTSIN  DD *`,
        `  WRITE *** CRITICAL ERROR: INTEGRITY MISMATCH ***`,
        `  WRITE *** OUTPUT FILE DISCARDED PER AUDIT POLICY ***`,
        `/*`,
        "",
    ].join("\n");
}

// --- Step 5: Report retrieval JCL (IEBGENER to SYSOUT) ------------------------

/**
 * JCL to copy the final report dataset to SYSOUT so it can be
 * captured from the printer/spool.
 */
export function buildReportJcl(
    jobName: string,
    reportDsn: string,
    user: string = "HERC01",
    password: string = "CUL8TR",
): string {
    const name = jclName(jobName);

    return [
        ...makeJobCard(name, "AUDIT-REPORT", user, password),
        `//STEP01   EXEC PGM=IEBGENER`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSUT1   DD DSN=${reportDsn},DISP=SHR`,
        `//SYSUT2   DD SYSOUT=*`,
        `//SYSIN    DD DUMMY`,
        `/*`,
        "",
    ].join("\n");
}

// --- Dataset name builder -----------------------------------------------------

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
