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
