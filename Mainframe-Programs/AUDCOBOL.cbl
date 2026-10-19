       IDENTIFICATION DIVISION.
       PROGRAM-ID.    AUDCOBOL.
       AUTHOR.        MAINFRAME-CODEBASE-AUDITOR.
      *================================================================*
      * REQUIREMENT 2 - COBOL TWO-FILE MATCH-MERGE                     *
      *                                                                *
      * READS TWO SEQUENTIAL FILES:                                    *
      *   FILE 1 (AUDREC):  REPO IMPORT METADATA FROM PLOTORIS         *
      *   FILE 2 (TECHREF): REFERENCE TABLE OF APPROVED TECHNOLOGIES   *
      *                                                                *
      * WRITES:                                                        *
      *   FILE 3 (AUDRPT):  MATCHED RECORDS WITH TECHNOLOGY CATEGORY   *
      *                     AND AUDIT STATUS                           *
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
           05  AR-IMPORT-COUNT    PIC 9(4).
           05  FILLER             PIC X(8).
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
           05  WS-AR-COUNT        PIC 9(4).
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
               MOVE AR-IMPORT-COUNT TO WS-AR-COUNT.
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
                   PERFORM 2200-WRITE-UNMATCHED-RECORD
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
       2200-WRITE-UNMATCHED-RECORD.
           MOVE SPACES             TO AUDRPT-RECORD.
           MOVE WS-AR-PATH-36      TO OUT-FILE-PATH.
           MOVE WS-AR-TECH         TO OUT-TECH-NAME.
           MOVE WS-AR-HASH         TO OUT-CONTENT-HASH.
           MOVE 'UNKNOWN   '       TO OUT-CATEGORY.
           MOVE WS-AR-USAGE-8      TO OUT-USAGE-TYPE.
           MOVE 'UNMATCHD'         TO OUT-MATCH-STATUS.
           WRITE AUDRPT-RECORD.
           ADD 1                   TO WS-UNMATCH-COUNT.
           ADD 1                   TO WS-OUTPUT-COUNT.
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
           DISPLAY '   SUCCESSFUL MATCHES       : ' DISP-MATCH.
           DISPLAY '   UNMATCHED/UNKNOWN TECHS  : ' DISP-UNMATCH.
           DISPLAY '   TOTAL RECORDS PRODUCED   : ' DISP-TOTAL.
           DISPLAY '--------------------------------------------------'.
           DISPLAY ' AUDCOBOL COMPLETED SUCCESSFULLY (RC=0000).       '.
           DISPLAY '=================================================='.
