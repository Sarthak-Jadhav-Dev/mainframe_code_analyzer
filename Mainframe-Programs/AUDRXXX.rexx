/* REXX */
/*==================================================================*/
/* AUDRXXX — MAINFRAME CODEBASE AUDITOR DEDUPLICATION & TAGGING    */
/* REQUIREMENT 3: REXX PROGRAM TO REMOVE DUPLICATE RECORDS BY       */
/*                PRIMARY KEY (CONTENT_HASH) AND SORT REMAINING     */
/*                RECORDS, ENRICHING CATEGORIES AND STATISTICS.    */
/*==================================================================*/

SAY "============================================================"
SAY " AUDRXXX: STARTING DEDUPLICATION & REPORT AGGREGATION       "
SAY " REQUIREMENT 3 — REMOVING DUPLICATE HASHES & SORTING        "
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
out_stem.out_idx = LEFT("=== MAINFRAME CODEBASE AUDITOR — AUDIT REPORT ===", 80)
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
out_stem.out_idx = LEFT("=== END OF REXX AUDIT STAGE — RC=0000 ===", 80)
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
