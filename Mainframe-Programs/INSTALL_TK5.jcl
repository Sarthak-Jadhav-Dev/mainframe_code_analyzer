//AUDINST1 JOB (ACCT),'INSTALL-AUDITOR',
//         CLASS=A,MSGCLASS=A,USER=HERC01,PASSWORD=CUL8TR
//*===================================================================*
//* INSTALLATION JCL FOR MAINFRAME CODEBASE AUDITOR                   *
//* 1. ALLOCATES HERC01.LOADLIB AND HERC01.EXEC                       *
//* 2. LOADS TECHREF INTO HERC01.AUDIT.TECHREF                        *
//* 3. COMPILES & LINKS AUDCOBOL INTO HERC01.LOADLIB(AUDCOBOL)        *
//*===================================================================*
//* STEP 1: ALLOCATE PDS LIBRARIES
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
//* STEP 2: LOAD TECHREF DATA
//STEP02   EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT2   DD DSN=HERC01.AUDIT.TECHREF,DISP=SHR
//SYSIN    DD DUMMY
//SYSUT1   DD *
ANGULAR   FRONTEND-FW Y                                                         
AWSSDK    INFRA       Y                                                         
AXIOS     HTTP-CLIENT Y                                                         
DRIZZLE   DATABASE    Y                                                         
ELYSIA    BACKEND     Y                                                         
EXPRESS   BACKEND     Y                                                         
FASTIFY   BACKEND     Y                                                         
FIREBASE  INFRA       Y                                                         
GOT       HTTP-CLIENT Y                                                         
JEST      TESTING     Y                                                         
KOA       BACKEND     Y                                                         
MONGOOSE  DATABASE    Y                                                         
NESTJS    BACKEND     Y                                                         
NEXTAUTH  AUTH        Y                                                         
NEXTJS    META-FW     Y                                                         
NODEFETCH HTTP-CLIENT Y                                                         
NUXT      META-FW     Y                                                         
PASSPORT  AUTH        Y                                                         
PLAYWRIGHTTESTING     Y                                                         
PRISMA    DATABASE    Y                                                         
REACT     FRONTEND-FW Y                                                         
REDUX     STATE       Y                                                         
SUPABASE  INFRA       Y                                                         
SVELTE    FRONTEND-FW Y                                                         
TAILWIND  STYLING     Y                                                         
TYPEORM   DATABASE    Y                                                         
VITE      BUILD       Y                                                         
VITEST    TESTING     Y                                                         
VUE       FRONTEND-FW Y                                                         
ZUSTAND   STATE       Y                                                         
/*
//* STEP 3: COMPILE AND LINK AUDCOBOL (USING COBOL PROCLIB)
//STEP03   EXEC COBUCL,PARM.COB='FLAGW,LOAD,NODECK'
//COB.SYSIN DD *
       IDENTIFICATION DIVISION.
       PROGRAM-ID.    AUDCOBOL.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT AUDREC-FILE  ASSIGN TO UT-S-AUDREC.
           SELECT TECHREF-FILE ASSIGN TO UT-S-TECHREF.
           SELECT AUDRPT-FILE  ASSIGN TO UT-S-AUDRPT.
       DATA DIVISION.
       FILE SECTION.
       FD  AUDREC-FILE
           RECORDING MODE IS F
           LABEL RECORDS ARE STANDARD
           RECORD CONTAINS 80 CHARACTERS
           DATA RECORD IS AUDREC-RECORD.
       01  AUDREC-RECORD.
           05  AR-FILE-PATH       PIC X(40).
           05  AR-TECH-NAME       PIC X(10).
           05  AR-CONTENT-HASH    PIC X(8).
           05  AR-USAGE-TYPE      PIC X(10).
           05  AR-IMPORT-COUNT    PIC 9(4).
           05  FILLER             PIC X(8).
       FD  TECHREF-FILE
           RECORDING MODE IS F
           LABEL RECORDS ARE STANDARD
           RECORD CONTAINS 80 CHARACTERS
           DATA RECORD IS TECHREF-RECORD.
       01  TECHREF-RECORD.
           05  TR-TECH-NAME       PIC X(10).
           05  TR-CATEGORY        PIC X(10).
           05  TR-CANONICAL-FLAG  PIC X(1).
           05  FILLER             PIC X(59).
       FD  AUDRPT-FILE
           RECORDING MODE IS F
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
       WORKING-STORAGE SECTION.
       01  WS-FLAGS.
           05  WS-AUDREC-EOF      PIC X(1)      VALUE 'N'.
               88  AUDREC-AT-EOF                VALUE 'Y'.
           05  WS-TECHREF-EOF     PIC X(1)      VALUE 'N'.
               88  TECHREF-AT-EOF               VALUE 'Y'.
       01  WS-SAVED-AUDREC.
           05  WS-AR-PATH.
               10  WS-AR-PATH-36  PIC X(36).
               10  FILLER         PIC X(4).
           05  WS-AR-TECH         PIC X(10).
           05  WS-AR-HASH         PIC X(8).
           05  WS-AR-USAGE.
               10  WS-AR-USAGE-8  PIC X(8).
               10  FILLER         PIC X(2).
           05  WS-AR-COUNT        PIC 9(4).
       01  WS-SAVED-TECHREF.
           05  WS-TR-TECH         PIC X(10).
           05  WS-TR-CAT          PIC X(10).
           05  WS-TR-CANON        PIC X(1).
       PROCEDURE DIVISION.
       0000-MAIN.
           OPEN INPUT AUDREC-FILE TECHREF-FILE
                OUTPUT AUDRPT-FILE.
           PERFORM 1100-READ-AUDREC.
           PERFORM 1200-READ-TECHREF.
           PERFORM 2000-PROCESS UNTIL AUDREC-AT-EOF AND TECHREF-AT-EOF.
           CLOSE AUDREC-FILE TECHREF-FILE AUDRPT-FILE.
           STOP RUN.
       1100-READ-AUDREC.
           READ AUDREC-FILE
               AT END
                   MOVE 'Y'         TO WS-AUDREC-EOF
                   MOVE HIGH-VALUES TO WS-AR-TECH.
           IF WS-AUDREC-EOF = 'N'
               MOVE AR-FILE-PATH    TO WS-AR-PATH
               MOVE AR-TECH-NAME    TO WS-AR-TECH
               MOVE AR-CONTENT-HASH TO WS-AR-HASH
               MOVE AR-USAGE-TYPE   TO WS-AR-USAGE
               MOVE AR-IMPORT-COUNT TO WS-AR-COUNT.
       1200-READ-TECHREF.
           READ TECHREF-FILE
               AT END
                   MOVE 'Y'         TO WS-TECHREF-EOF
                   MOVE HIGH-VALUES TO WS-TR-TECH.
           IF WS-TECHREF-EOF = 'N'
               MOVE TR-TECH-NAME      TO WS-TR-TECH
               MOVE TR-CATEGORY       TO WS-TR-CAT
               MOVE TR-CANONICAL-FLAG TO WS-TR-CANON.
       2000-PROCESS.
           IF WS-AR-TECH = WS-TR-TECH
               MOVE SPACES TO AUDRPT-RECORD
               MOVE WS-AR-PATH-36 TO OUT-FILE-PATH
               MOVE WS-AR-TECH TO OUT-TECH-NAME
               MOVE WS-AR-HASH TO OUT-CONTENT-HASH
               MOVE WS-TR-CAT TO OUT-CATEGORY
               MOVE WS-AR-USAGE-8 TO OUT-USAGE-TYPE
               MOVE 'MATCHED ' TO OUT-MATCH-STATUS
               WRITE AUDRPT-RECORD
               PERFORM 1100-READ-AUDREC
           ELSE
               IF WS-AR-TECH < WS-TR-TECH
                   MOVE SPACES TO AUDRPT-RECORD
                   MOVE WS-AR-PATH-36 TO OUT-FILE-PATH
                   MOVE WS-AR-TECH TO OUT-TECH-NAME
                   MOVE WS-AR-HASH TO OUT-CONTENT-HASH
                   MOVE 'UNKNOWN   ' TO OUT-CATEGORY
                   MOVE WS-AR-USAGE-8 TO OUT-USAGE-TYPE
                   MOVE 'UNMATCHD' TO OUT-MATCH-STATUS
                   WRITE AUDRPT-RECORD
                   PERFORM 1100-READ-AUDREC
               ELSE
                   PERFORM 1200-READ-TECHREF.
/*
//LKED.SYSLMOD DD DSN=HERC01.LOADLIB(AUDCOBOL),DISP=SHR
/*
