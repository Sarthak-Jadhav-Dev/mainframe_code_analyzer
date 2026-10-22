//AUDINST1 JOB (ACCT),'INSTALL-AUDITOR',
//         CLASS=A,MSGCLASS=A,USER=HERC01,PASSWORD=CUL8TR
//*===================================================================*
//* INSTALLATION JCL FOR MAINFRAME CODEBASE AUDITOR                   *
//* 1. ALLOCATES HERC01.LOADLIB AND HERC01.EXEC                       *
//* 2. LOADS TECHREF INTO HERC01.AUDIT.TECHREF                        *
//* 3. LOADS AUDRXXX AND AUDCOUNT INTO HERC01.EXEC                    *
//* 4. COMPILES & LINKS AUDCOBOL INTO HERC01.LOADLIB(AUDCOBOL)        *
//*===================================================================*
//* STEP 1: ALLOCATE PDS LIBRARIES & SEQUENTIAL DATASETS
//STEP01   EXEC PGM=IEFBR14
//LOADLIB  DD DSN=HERC01.LOADLIB,
//            DISP=(MOD,CATLG),
//            UNIT=3390,VOL=SER=WORK01,
//            SPACE=(CYL,(2,1,10)),
//            DCB=(RECFM=U,BLKSIZE=19069)
//EXECPDS  DD DSN=HERC01.EXEC,
//            DISP=(MOD,CATLG),
//            UNIT=3390,VOL=SER=WORK01,
//            SPACE=(CYL,(1,1,10)),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=3120)
//TECHREF  DD DSN=HERC01.AUDIT.TECHREF,
//            DISP=(MOD,CATLG),
//            UNIT=3390,VOL=SER=WORK01,
//            SPACE=(CYL,(1,1)),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=800)
//*
//* STEP 2: LOAD TECHREF REFERENCE TABLE (96 KNOWN TECHNOLOGIES)
//STEP02   EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT2   DD DSN=HERC01.AUDIT.TECHREF,DISP=SHR
//SYSIN    DD DUMMY
//SYSUT1   DD *
ANGULAR   FRONTEND  Y                                                           
ASTRO     META-FW   Y                                                           
ASYNCIO   PY-STDLIB Y                                                           
AWSSDK    CLOUD     Y                                                           
AWSSDK-JAVCLOUD     Y                                                           
AXIOS     HTTP-CLI  Y                                                           
BOOST     CPP-LIB   Y                                                           
BOTO3     CLOUD     Y                                                           
CELERY    TASK-QUEUEY                                                           
CICS-JCL  MIDDLEWAREY                                                           
COBOL-CICSMIDDLEWAREY                                                           
COBOL-DB2 DATABASE  Y                                                           
COBOL-FILEIO        Y                                                           
COBOL-IMS DATABASE  Y                                                           
COBOL-SORTJCL-UTIL  Y                                                           
DB2-JCL   DATABASE  Y                                                           
DFSORT    JCL-UTIL  Y                                                           
DJANGO    PY-FW     Y                                                           
DRIZZLE   DATABASE  Y                                                           
ELYSIA    BACKEND   Y                                                           
EXPRESS   BACKEND   Y                                                           
FASTAPI   PY-FW     Y                                                           
FASTIFY   BACKEND   Y                                                           
FIREBASE  CLOUD     Y                                                           
FLASK     PY-FW     Y                                                           
GOT       HTTP-CLI  Y                                                           
GRPC-JAVA RPC       Y                                                           
HADOOP    BIG-DATA  Y                                                           
HIBERNATE DATABASE  Y                                                           
IMS-JCL   DATABASE  Y                                                           
JAKARTA-EEJVM-FW    Y                                                           
JCL-IDCAMSJCL-UTIL  Y                                                           
JCL-IEBCOPJCL-UTIL  Y                                                           
JCL-IEBGENJCL-UTIL  Y                                                           
JCL-IEFBR1JCL-UTIL  Y                                                           
JCL-SORT  JCL-UTIL  Y                                                           
JDBC      DATABASE  Y                                                           
JEST      TESTING   Y                                                           
JUNIT     TESTING   Y                                                           
KAFKA-JAVAMESSAGING Y                                                           
KOA       BACKEND   Y                                                           
LIBCURL   HTTP-CLI  Y                                                           
LOG4J     LOGGING   Y                                                           
MATPLOTLIBPY-SCIENCEY                                                           
MOCKITO   TESTING   Y                                                           
MONGOOSE  DATABASE  Y                                                           
MQ-JCL    MESSAGING Y                                                           
NESTJS    BACKEND   Y                                                           
NEXTAUTH  AUTH      Y                                                           
NEXTJS    META-FW   Y                                                           
NODEFETCH HTTP-CLI  Y                                                           
NUMPY     PY-SCIENCEY                                                           
NUXT      META-FW   Y                                                           
OPENSSL   SECURITY  Y                                                           
OS-MODULE PY-STDLIB Y                                                           
PANDAS    PY-SCIENCEY                                                           
PASSPORT  AUTH      Y                                                           
PLAYWRIGHTTESTING   Y                                                           
POCO      CPP-LIB   Y                                                           
POSIX     C-STDLIB  Y                                                           
PRISMA    DATABASE  Y                                                           
PYDANTIC  PY-LIB    Y                                                           
PYTORCH   PY-ML     Y                                                           
QT        CPP-GUI   Y                                                           
REACT     FRONTEND  Y                                                           
REDUX     STATE     Y                                                           
REMIX     META-FW   Y                                                           
REQUESTS  HTTP-CLI  Y                                                           
REXX-ISPF MAINFRAME Y                                                           
REXX-MVS  MAINFRAME Y                                                           
REXX-SQL  DATABASE  Y                                                           
REXX-SYSVAMAINFRAME Y                                                           
REXX-TSO  MAINFRAME Y                                                           
SCIPY     PY-SCIENCEY                                                           
SKLEARN   PY-ML     Y                                                           
SLF4J     LOGGING   Y                                                           
SOLIDJS   FRONTEND  Y                                                           
SPARK     BIG-DATA  Y                                                           
SPRING    JVM-FW    Y                                                           
SPRING-BOOJVM-FW    Y                                                           
SQLALCHEMYDATABASE  Y                                                           
SQLITE-C  DATABASE  Y                                                           
STDLIB-C  C-STDLIB  Y                                                           
STL       CPP-LIB   Y                                                           
SUBPROCESSPY-STDLIB Y                                                           
SUPABASE  CLOUD     Y                                                           
SVELTE    FRONTEND  Y                                                           
SYS-MODULEPY-STDLIB Y                                                           
TAILWIND  STYLING   Y                                                           
TENSORFLOWPY-ML     Y                                                           
TYPEORM   DATABASE  Y                                                           
VITE      BUILD     Y                                                           
VITEST    TESTING   Y                                                           
VUE       FRONTEND  Y                                                           
ZLIB      COMPRESS  Y                                                           
ZUSTAND   STATE     Y
/*
//*
//* STEP 3: LOAD AUDRXXX (DEDUPE & PRIMARY KEY SORT) INTO HERC01.EXEC
//STEP03   EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT2   DD DSN=HERC01.EXEC(AUDRXXX),DISP=SHR
//SYSIN    DD DUMMY
//SYSUT1   DD *
/* REXX */
/*==================================================================*/
/* AUDRXXX - MAINFRAME CODEBASE AUDITOR DEDUPLICATION & TAGGING    */
/* REQUIREMENT 3: REXX PROGRAM TO REMOVE DUPLICATE RECORDS BY       */
/*                PRIMARY KEY (CONTENT_HASH) AND SORT REMAINING     */
/*                RECORDS, ENRICHING CATEGORIES AND STATISTICS.    */
/*==================================================================*/

SAY "============================================================"
SAY " AUDRXXX: STARTING DEDUPLICATION & REPORT AGGREGATION       "
SAY " REQUIREMENT 3 - REMOVING DUPLICATE HASHES & SORTING        "
SAY "============================================================"

/* 1. Allocate & Read Input from AUDRPT */
"EXECIO * DISKR AUDRPT (STEM in_rec. FINIS"
IF rc \= 0 THEN DO
    SAY "ERROR: Failed to read AUDRPT dataset, RC=" rc
    EXIT 12
END

total_in = in_rec.0
SAY "  Total Input Records Read from COBOL Output: " total_in

IF total_in = 0 THEN DO
    SAY "WARNING: No input records to process in AUDRPT."
    "EXECIO 0 DISKW AUDOUT (FINIS"
    EXIT 0
END

/* 2. Deduplication using associative stem on CONTENT_HASH (cols 47-54) */
seen_hash.   = 0
unique_count = 0
dup_count    = 0

DO i = 1 TO total_in
    rec   = in_rec.i
    fpath = STRIP(SUBSTR(rec, 1, 36))
    tech  = STRIP(SUBSTR(rec, 37, 10))
    hash  = STRIP(SUBSTR(rec, 47, 8))
    cat   = STRIP(SUBSTR(rec, 55, 10))
    usage = STRIP(SUBSTR(rec, 65, 8))
    stat  = STRIP(SUBSTR(rec, 73, 8))

    /* Check if hash already encountered */
    IF seen_hash.hash = 1 THEN DO
        dup_count = dup_count + 1
        dup_rec.dup_count = "DUP: " || LEFT(fpath, 30) || " HASH=" || hash || " MATCHES=" || original_file.hash
    END
    ELSE DO
        seen_hash.hash = 1
        original_file.hash = fpath
        unique_count = unique_count + 1
        uniq_rec.unique_count = rec
        uniq_hash.unique_count = hash
        uniq_fpath.unique_count = fpath
    END
END

SAY "  Unique Records Retained: " unique_count
SAY "  Duplicate Records Removed: " dup_count

/* 3. Sort Unique Records by Primary Key (CONTENT_HASH + FILE_PATH) */
/* Bubble sort on unique records array */
IF unique_count > 1 THEN DO
    DO i = 1 TO unique_count - 1
        DO j = 1 TO unique_count - i
            next_j = j + 1
            key1 = uniq_hash.j || uniq_fpath.j
            key2 = uniq_hash.next_j || uniq_fpath.next_j
            IF key1 > key2 THEN DO
                /* Swap records */
                temp_rec = uniq_rec.j
                temp_hash = uniq_hash.j
                temp_fpath = uniq_fpath.j

                uniq_rec.j = uniq_rec.next_j
                uniq_hash.j = uniq_hash.next_j
                uniq_fpath.j = uniq_fpath.next_j

                uniq_rec.next_j = temp_rec
                uniq_hash.next_j = temp_hash
                uniq_fpath.next_j = temp_fpath
            END
        END
    END
END

/* 4. Prepare Output Dataset Stream */
out_idx = 0

/* Header Banner */
out_idx = out_idx + 1
out_stem.out_idx = LEFT("=== MAINFRAME CODEBASE AUDITOR - AUDIT REPORT ===", 80)
out_idx = out_idx + 1
out_stem.out_idx = LEFT("STAGE: REXX DEDUPLICATION & PRIMARY-KEY SORT (REQ 3)", 80)
out_idx = out_idx + 1
out_stem.out_idx = LEFT("----------------------------------------------------------------", 80)

/* Column Headers */
out_idx = out_idx + 1
out_stem.out_idx = LEFT("FILE PATH                            TECH       HASH     CAT        USAGE", 80)
out_idx = out_idx + 1
out_stem.out_idx = LEFT("------------------------------------ ---------- -------- ---------- --------", 80)

/* Output sorted unique records */
DO i = 1 TO unique_count
    out_idx = out_idx + 1
    out_stem.out_idx = LEFT(uniq_rec.i, 80)
END

/* Summary Section */
out_idx = out_idx + 1
out_stem.out_idx = LEFT("----------------------------------------------------------------", 80)
out_idx = out_idx + 1
out_stem.out_idx = LEFT("SUMMARY STATISTICS:", 80)
out_idx = out_idx + 1
out_stem.out_idx = LEFT("  TOTAL INPUT RECORDS READ  : " || total_in, 80)
out_idx = out_idx + 1
out_stem.out_idx = LEFT("  UNIQUE RECORDS RETAINED   : " || unique_count, 80)
out_idx = out_idx + 1
out_stem.out_idx = LEFT("  DUPLICATE RECORDS REMOVED : " || dup_count, 80)

/* List duplicate files if any */
IF dup_count > 0 THEN DO
    out_idx = out_idx + 1
    out_stem.out_idx = LEFT("IDENTIFIED DUPLICATE FILES:", 80)
    DO d = 1 TO dup_count
        out_idx = out_idx + 1
        out_stem.out_idx = LEFT("  " || dup_rec.d, 80)
    END
END

out_idx = out_idx + 1
out_stem.out_idx = LEFT("=== END OF REXX AUDIT STAGE - RC=0000 ===", 80)
out_stem.0 = out_idx

/* 5. Write to AUDOUT */
"EXECIO * DISKW AUDOUT (STEM out_stem. FINIS"
IF rc \= 0 THEN DO
    SAY "ERROR: Failed to write to AUDOUT dataset, RC=" rc
    EXIT 12
END

SAY "  Successfully written " out_stem.0 " records to AUDOUT."
SAY " AUDRXXX COMPLETED SUCCESSFULLY (RC=0000)."
SAY "============================================================"
EXIT 0
/*
//*
//* STEP 4: LOAD AUDCOUNT (COUNT INTEGRITY COMPARATOR) INTO HERC01.EXEC
//STEP04   EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT2   DD DSN=HERC01.EXEC(AUDCOUNT),DISP=SHR
//SYSIN    DD DUMMY
//SYSUT1   DD *
/* REXX */
/*==================================================================*/
/* AUDCOUNT - RECORD COUNT COMPARATOR FOR REQUIREMENT 4             */
/* COMPARES RECORD COUNTS OF TWO DATASETS (DS1 VS DS2)              */
/* EXITS WITH RC=0 IF MATCH, RC=12 IF MISMATCH                      */
/*==================================================================*/

SAY "============================================================"
SAY " AUDCOUNT: DATA INTEGRITY VERIFIER - REQUIREMENT 4          "
SAY " COMPARING RECORD COUNTS BEFORE AND AFTER DESCENDING SORT   "
SAY "============================================================"

/* 1. Read Dataset 1 (Before Sort) */
"EXECIO 0 DISKR DS1 (OPEN"
IF rc \= 0 THEN DO
    SAY "ERROR: Unable to open input dataset DS1, RC=" rc
    EXIT 16
END

count1 = 0
DO FOREVER
    "EXECIO 1 DISKR DS1"
    IF rc \= 0 THEN LEAVE
    PULL line
    count1 = count1 + 1
END
"EXECIO 0 DISKR DS1 (FINIS"

/* 2. Read Dataset 2 (After Sort) */
"EXECIO 0 DISKR DS2 (OPEN"
IF rc \= 0 THEN DO
    SAY "ERROR: Unable to open sorted dataset DS2, RC=" rc
    EXIT 16
END

count2 = 0
DO FOREVER
    "EXECIO 1 DISKR DS2"
    IF rc \= 0 THEN LEAVE
    PULL line
    count2 = count2 + 1
END
"EXECIO 0 DISKR DS2 (FINIS"

SAY "  Total Records in Original File (DS1) : " count1
SAY "  Total Records in Sorted File   (DS2) : " count2
SAY "------------------------------------------------------------"

/* 3. Compare Counts */
IF count1 = count2 THEN DO
    SAY " SUCCESS: RECORD COUNTS MATCH EXACTLY!"
    SAY " DATA INTEGRITY VERIFIED: ZERO RECORDS DROPPED DURING SORT."
    SAY " CONDITION CODE 0000 WILL TRIGGER STEPKEEP TO SAVE OUTPUT."
    SAY "============================================================"
    EXIT 0
END
ELSE DO
    diff = count1 - count2
    SAY " *** CRITICAL ERROR: RECORD COUNT MISMATCH DETECTED! ***"
    SAY " EXPECTED " count1 " RECORDS, BUT FOUND " count2 " RECORDS (DIFF=" diff ")."
    SAY " DATA INTEGRITY VIOLATION: OUTPUT FILE WILL BE DISCARDED!"
    SAY " CONDITION CODE 0012 WILL TRIGGER STEPERR."
    SAY "============================================================"
    EXIT 12
END
/*
//*
//* STEP 5: COMPILE AND LINK AUDCOBOL (USING COBOL PROCLIB)
//STEP05   EXEC COBUCL,PARM.COB='FLAGW,LOAD,NODECK'
//COB.SYSIN DD *
       IDENTIFICATION DIVISION.
       PROGRAM-ID.    AUDCOBOL.
       AUTHOR.        MAINFRAME-CODEBASE-AUDITOR.
      *================================================================*
      * REQUIREMENT 2 - COBOL TWO-FILE MATCH-MERGE                     *
      *                                                                *
      * READS TWO SEQUENTIAL FILES:                                    *
      *   FILE 1 (AUDREC):  SORTED PLOTORIS FLAT FILE (from JCL SORT) *
      *                     Per-file metadata: path, ext, line count,  *
      *                     content hash, detected tech/category.      *
      *   FILE 2 (TECHREF): REFERENCE TABLE OF KNOWN TECHNOLOGIES      *
      *                     (static list: React, Express, Axios, etc.) *
      *                                                                *
      * WRITES (matched records ONLY):                                 *
      *   FILE 3 (AUDRPT):  RECORDS WHERE TECH IN FILE 1 IS CONFIRMED  *
      *                     AGAINST THE TECHREF REFERENCE LIST.        *
      *                     UNMATCHED RECORDS ARE INTENTIONALLY SKIPPED.*
      *================================================================*
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT AUDREC-FILE  ASSIGN TO UT-S-AUDREC.
           SELECT TECHREF-FILE ASSIGN TO UT-S-TECHREF.
           SELECT AUDRPT-FILE  ASSIGN TO UT-S-AUDRPT.
      *
       DATA DIVISION.
       FILE SECTION.
      *
       FD  AUDREC-FILE
           BLOCK CONTAINS 0 RECORDS
           LABEL RECORDS ARE STANDARD
           RECORD CONTAINS 80 CHARACTERS
           DATA RECORD IS AUDREC-RECORD.
       01  AUDREC-RECORD.
           05  AR-FILE-PATH       PIC X(40).
           05  AR-TECH-NAME       PIC X(10).
           05  AR-CONTENT-HASH    PIC X(8).
           05  AR-USAGE-TYPE      PIC X(10).
           05  AR-EXTENSION       PIC X(4).
           05  AR-LINE-COUNT      PIC 9(5).
           05  FILLER             PIC X(3).
      *
       FD  TECHREF-FILE
           BLOCK CONTAINS 0 RECORDS
           LABEL RECORDS ARE STANDARD
           RECORD CONTAINS 80 CHARACTERS
           DATA RECORD IS TECHREF-RECORD.
       01  TECHREF-RECORD.
           05  TR-TECH-NAME       PIC X(10).
           05  TR-CATEGORY        PIC X(10).
           05  TR-CANONICAL-FLAG  PIC X(1).
           05  FILLER             PIC X(59).
      *
       FD  AUDRPT-FILE
           BLOCK CONTAINS 0 RECORDS
           LABEL RECORDS ARE STANDARD
           RECORD CONTAINS 80 CHARACTERS
           DATA RECORD IS AUDRPT-RECORD.
       01  AUDRPT-RECORD.
           05  OUT-FILE-PATH      PIC X(36).
           05  OUT-TECH-NAME      PIC X(10).
           05  OUT-CONTENT-HASH   PIC X(8).
           05  OUT-CATEGORY       PIC X(10).
           05  OUT-USAGE-TYPE     PIC X(8).
           05  OUT-MATCH-STATUS   PIC X(8).
      *
       WORKING-STORAGE SECTION.
      *--- END-OF-FILE FLAGS ---*
       01  WS-FLAGS.
           05  WS-AUDREC-EOF      PIC X(1)      VALUE 'N'.
               88  AUDREC-AT-EOF                VALUE 'Y'.
           05  WS-TECHREF-EOF     PIC X(1)      VALUE 'N'.
               88  TECHREF-AT-EOF               VALUE 'Y'.
      *
      *--- RUN COUNTERS ---*
       01  WS-COUNTERS.
           05  WS-AUDREC-COUNT    PIC 9(6)      VALUE ZERO.
           05  WS-TECHREF-COUNT   PIC 9(6)      VALUE ZERO.
           05  WS-MATCH-COUNT     PIC 9(6)      VALUE ZERO.
           05  WS-UNMATCH-COUNT   PIC 9(6)      VALUE ZERO.
           05  WS-OUTPUT-COUNT    PIC 9(6)      VALUE ZERO.
      *
      *--- FORMATTED COUNTERS FOR DISPLAY ---*
       01  WS-DISP-COUNTERS.
           05  DISP-AUDREC        PIC ZZZ,ZZ9.
           05  DISP-TECHREF       PIC ZZZ,ZZ9.
           05  DISP-MATCH         PIC ZZZ,ZZ9.
           05  DISP-UNMATCH       PIC ZZZ,ZZ9.
           05  DISP-TOTAL         PIC ZZZ,ZZ9.
      *
      *--- SAVED RECORD STORAGE FOR MATCHING ---*
       01  WS-SAVED-AUDREC.
           05  WS-AR-PATH.
               10  WS-AR-PATH-36  PIC X(36).
               10  FILLER         PIC X(4).
           05  WS-AR-TECH         PIC X(10).
           05  WS-AR-HASH         PIC X(8).
           05  WS-AR-USAGE.
               10  WS-AR-USAGE-8  PIC X(8).
               10  FILLER         PIC X(2).
           05  WS-AR-EXT          PIC X(4).
           05  WS-AR-LINES        PIC 9(5).
      *
       01  WS-SAVED-TECHREF.
           05  WS-TR-TECH         PIC X(10).
           05  WS-TR-CAT          PIC X(10).
           05  WS-TR-CANON        PIC X(1).
      *
      *================================================================*
       PROCEDURE DIVISION.
      *================================================================*
       0000-MAIN-CONTROL.
           PERFORM 1000-INITIALIZATION.
           PERFORM 2000-PROCESS-MATCH-MERGE
               UNTIL AUDREC-AT-EOF AND TECHREF-AT-EOF.
           PERFORM 3000-TERMINATION.
           STOP RUN.
      *
       1000-INITIALIZATION.
           DISPLAY '=================================================='.
           DISPLAY ' AUDCOBOL: STARTING TWO-FILE MATCH-MERGE AUDIT    '.
           DISPLAY ' REQUIREMENT 2 - VALIDATING TECH AGAINST TECHREF  '.
           DISPLAY '=================================================='.
           OPEN INPUT  AUDREC-FILE
                       TECHREF-FILE
                OUTPUT AUDRPT-FILE.
           PERFORM 1100-READ-AUDREC.
           PERFORM 1200-READ-TECHREF.
      *
       1100-READ-AUDREC.
           READ AUDREC-FILE
               AT END
                   MOVE 'Y'         TO WS-AUDREC-EOF
                   MOVE HIGH-VALUES TO WS-AR-TECH.
           IF WS-AUDREC-EOF = 'N'
               ADD 1               TO WS-AUDREC-COUNT
               MOVE AR-FILE-PATH   TO WS-AR-PATH
               MOVE AR-TECH-NAME   TO WS-AR-TECH
               MOVE AR-CONTENT-HASH TO WS-AR-HASH
               MOVE AR-USAGE-TYPE  TO WS-AR-USAGE
               MOVE AR-EXTENSION   TO WS-AR-EXT
               MOVE AR-LINE-COUNT  TO WS-AR-LINES.
      *
       1200-READ-TECHREF.
           READ TECHREF-FILE
               AT END
                   MOVE 'Y'         TO WS-TECHREF-EOF
                   MOVE HIGH-VALUES TO WS-TR-TECH.
           IF WS-TECHREF-EOF = 'N'
               ADD 1               TO WS-TECHREF-COUNT
               MOVE TR-TECH-NAME   TO WS-TR-TECH
               MOVE TR-CATEGORY    TO WS-TR-CAT
               MOVE TR-CANONICAL-FLAG TO WS-TR-CANON.
      *
       2000-PROCESS-MATCH-MERGE.
           IF WS-AR-TECH = WS-TR-TECH
               PERFORM 2100-WRITE-MATCHED-RECORD
               PERFORM 1100-READ-AUDREC
           ELSE
               IF WS-AR-TECH < WS-TR-TECH
      *            AUDREC tech not in TECHREF - skip (not written)
                   PERFORM 2200-SKIP-UNMATCHED
                   PERFORM 1100-READ-AUDREC
               ELSE
                   PERFORM 1200-READ-TECHREF.
      *
       2100-WRITE-MATCHED-RECORD.
           MOVE SPACES             TO AUDRPT-RECORD.
           MOVE WS-AR-PATH-36      TO OUT-FILE-PATH.
           MOVE WS-AR-TECH         TO OUT-TECH-NAME.
           MOVE WS-AR-HASH         TO OUT-CONTENT-HASH.
           MOVE WS-TR-CAT          TO OUT-CATEGORY.
           MOVE WS-AR-USAGE-8      TO OUT-USAGE-TYPE.
           MOVE 'MATCHED '         TO OUT-MATCH-STATUS.
           WRITE AUDRPT-RECORD.
           ADD 1                   TO WS-MATCH-COUNT.
           ADD 1                   TO WS-OUTPUT-COUNT.
      *
      * 2200: Unmatched records are intentionally NOT written to output.
      *       Requirement 2 states File 3 contains ONLY matched records.
       2200-SKIP-UNMATCHED.
           ADD 1                   TO WS-UNMATCH-COUNT.
      *
       3000-TERMINATION.
           CLOSE AUDREC-FILE
                 TECHREF-FILE
                 AUDRPT-FILE.
           MOVE WS-AUDREC-COUNT    TO DISP-AUDREC.
           MOVE WS-TECHREF-COUNT   TO DISP-TECHREF.
           MOVE WS-MATCH-COUNT     TO DISP-MATCH.
           MOVE WS-UNMATCH-COUNT   TO DISP-UNMATCH.
           MOVE WS-OUTPUT-COUNT    TO DISP-TOTAL.
           DISPLAY '--------------------------------------------------'.
           DISPLAY ' AUDCOBOL SUMMARY STATISTICS:                     '.
           DISPLAY '   INPUT AUDREC RECORDS READ: ' DISP-AUDREC.
           DISPLAY '   TECHREF REFERENCES READ  : ' DISP-TECHREF.
           DISPLAY '   MATCHED RECORDS WRITTEN  : ' DISP-MATCH.
           DISPLAY '   UNMATCHED RECORDS SKIPPED: ' DISP-UNMATCH.
           DISPLAY '   TOTAL OUTPUT RECORDS     : ' DISP-TOTAL.
           DISPLAY '   (Only matched records written per Req 2 policy)'.
           DISPLAY '--------------------------------------------------'.
           DISPLAY ' AUDCOBOL COMPLETED SUCCESSFULLY (RC=0000).       '.
           DISPLAY '=================================================='.
/*
//LKED.SYSLMOD DD DSN=HERC01.LOADLIB(AUDCOBOL),DISP=SHR
/*
