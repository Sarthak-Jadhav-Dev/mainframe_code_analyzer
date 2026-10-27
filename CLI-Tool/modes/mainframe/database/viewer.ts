/**
 * Mainframe Database & VSAM Storage — Interactive Database Viewer
 * ----------------------------------------------------------------
 * Rich terminal interface for browsing, inspecting, and managing
 * execution histories stored in the VSAM KSDS database.
 */

import chalk from "chalk";
import path from "node:path";
import fs from "node:fs";
import { select, text, confirm, spinner, isCancel } from "@clack/prompts";
import type { MainframeExecutionRecord, VsamQueryFilter } from "./types.ts";
import {
    loadAllRecords,
    queryRecords,
    getRecordById,
    deleteRecord,
    clearAllRecords,
    getClusterMetadata,
    runLiveIdcamsPrint,
} from "./vsam-storage.ts";
import { ICONS } from "../../../terminal_ui/icons.ts";
import { VSAM_CLUSTER_NAME, VSAM_DATASET_NAME } from "./vsam-jcl.ts";

// ─── Theme Colors ─────────────────────────────────────────────────────────────

const CYAN    = chalk.hex("#00d4ff");
const PURPLE  = chalk.hex("#a855f7");
const GREEN   = chalk.hex("#4ade80");
const YELLOW  = chalk.hex("#facc15");
const RED     = chalk.hex("#f87171");
const BLUE    = chalk.hex("#60a5fa");
const MAGENTA = chalk.hex("#ec4899");
const DIM     = chalk.dim;
const BOLD    = chalk.bold;
const INVERSE = chalk.inverse;

// ─── Report Colorizer ─────────────────────────────────────────────────────────

export function colorizeReport(raw: string): string {
    const lines = raw.split("\n");
    return lines.map((line) => {
        if (line.includes("═".repeat(10)) || line.includes("─".repeat(20))) {
            return PURPLE.bold(line);
        }
        if (line.includes("MAINFRAME") || line.includes("AUDIT REPORT") || line.includes("AUDIT COMPLETE") || line.includes("ASSIGNMENT AUDIT")) {
            return CYAN.bold(line);
        }
        if (line.includes("SECTION") || line.includes("[STAGE") || line.includes("[REQ")) {
            return CYAN.bold(line);
        }
        if (line.includes("RC=0000") || line.includes("COMPLETED") || line.includes("CONSISTENT") || line.includes("SUCCESSFUL") || line.includes("VERIFIED") || line.includes("PASS")) {
            line = line.replace(/(RC=0000|COMPLETED|CONSISTENT|SUCCESSFUL|VERIFIED|PASS)/g, (m) => GREEN.bold(m));
        }
        if (line.includes("RC=0012") || line.includes("INCOMPLETE") || line.includes("INCONSISTENT") || line.includes("MISMATCH") || line.includes("FAILED") || line.includes("ERROR") || line.includes("DISCARDED")) {
            line = line.replace(/(RC=0012|INCOMPLETE|INCONSISTENT|MISMATCH|FAILED|ERROR|DISCARDED)/g, (m) => RED.bold(m));
        }
        if (line.includes("SIMULATED") || line.includes("PARTIALLY") || line.includes("WARNING")) {
            line = line.replace(/(SIMULATED|PARTIALLY_COMPLETED|PARTIALLY|WARNING)/g, (m) => YELLOW.bold(m));
        }
        if (line.includes("GENUINE")) {
            line = line.replace(/GENUINE/g, GREEN.bold("GENUINE"));
        }
        if (line.includes("PSEUDO")) {
            line = line.replace(/PSEUDO/g, YELLOW.bold("PSEUDO"));
        }
        if (line.includes(" : ") || line.includes(" :")) {
            line = line.replace(/^(\s*[^:]+)(\s*:\s*)(.*)$/, (_, label, sep, val) => {
                let styledVal = val;
                if (val.includes("%")) {
                    styledVal = CYAN.bold(val);
                } else if (/^[A-F][+-]?$/.test(val.trim())) {
                    styledVal = GREEN.bold(val);
                }
                return BOLD(label) + sep + styledVal;
            });
        }
        if (line.includes("┌") || line.includes("├") || line.includes("└") || line.includes("│") || line.includes("╭") || line.includes("╰")) {
            line = line.replace(/[┌─┐├┤└┘│╭╰]/g, (b) => PURPLE(b));
        }
        return line;
    }).join("\n");
}

function printDatabaseBanner() {
    console.log();
    console.log(PURPLE.bold("  ╔══════════════════════════════════════════════════════════════════════╗"));
    console.log(PURPLE.bold("  ║  ") + CYAN.bold("🗄️  MAINFRAME VSAM KSDS DATABASE & EXECUTION HISTORY") + PURPLE.bold("                ║"));
    console.log(PURPLE.bold("  ║  ") + DIM(`Dataset: ${VSAM_CLUSTER_NAME.padEnd(26)} Org: INDEXED (KSDS) • DASD: 3390`) + PURPLE.bold("║"));
    console.log(PURPLE.bold("  ╚══════════════════════════════════════════════════════════════════════╝"));
    console.log();
}

/**
 * Main entry point for the Database Viewer
 */
export async function runDatabaseViewerMode(): Promise<void> {
    while (true) {
        printDatabaseBanner();
        const records = loadAllRecords();
        const codeCount = records.filter((r) => r.executionType === "CODEBASE_PROJECT").length;
        const asgnCount = records.filter((r) => r.executionType === "ASSIGNMENT").length;

        console.log(
            `  ${BOLD("Database Statistics:")} ` +
            chalk.bgCyan.black.bold(` TOTAL: ${records.length} `) + " " +
            chalk.bgBlue.black.bold(` CODE PROJECTS: ${codeCount} `) + " " +
            chalk.bgMagenta.black.bold(` ASSIGNMENTS: ${asgnCount} `) + "\n"
        );

        const action = await select({
            message: BOLD("Select Database Operation:"),
            options: [
                {
                    value: "browse",
                    label: `${ICONS.search} Browse Execution History (${records.length} total runs)`,
                },
                {
                    value: "filter",
                    label: `${ICONS.stats} Filter & Query Records (by Type, Status, Keyword, Z_ID)`,
                },
                {
                    value: "telemetry",
                    label: `${ICONS.mainframe} VSAM Cluster Architecture & Storage Telemetry`,
                },
                {
                    value: "live_print",
                    label: `${ICONS.doc} Live IDCAMS PRINT on Hercules TK5 Spool`,
                },
                {
                    value: "export",
                    label: `${ICONS.folder} Export History (JSON / TXT / CSV)`,
                },
                {
                    value: "manage",
                    label: `${ICONS.warn} Manage / Purge Database Records`,
                },
                {
                    value: "exit",
                    label: `${ICONS.exit} Return to Mainframe Mode Menu`,
                },
            ],
        });

        if (isCancel(action) || action === "exit") {
            break;
        }

        if (action === "browse") {
            await browseRecordsFlow(records);
        } else if (action === "filter") {
            await filterRecordsFlow();
        } else if (action === "telemetry") {
            await showClusterTelemetry();
        } else if (action === "live_print") {
            await runLiveIdcamsFlow();
        } else if (action === "export") {
            await exportRecordsFlow(records);
        } else if (action === "manage") {
            await manageDatabaseFlow();
        }
    }
}

// ─── Browse Records ───────────────────────────────────────────────────────────

async function browseRecordsFlow(records: MainframeExecutionRecord[], title = "Select Execution Record to Inspect:"): Promise<void> {
    if (records.length === 0) {
        console.log(YELLOW(`\n  ${ICONS.warn} No execution history found in VSAM database.\n`));
        console.log(DIM("  Execute a Codebase Project or Assignment audit to record history.\n"));
        await text({ message: "Press Enter to return..." });
        return;
    }

    const options = records.map((r) => {
        const isCode = r.executionType === "CODEBASE_PROJECT";
        const typeBadge = isCode ? chalk.bgBlue.black.bold(" CODE ") : chalk.bgMagenta.black.bold(" ASGN ");
        const statusBadge = r.status === "PASS" ? chalk.bgGreen.black.bold(" PASS ") : r.status === "SIMULATED" ? chalk.bgYellow.black.bold(" SIMU ") : chalk.bgRed.white.bold(" FAIL ");
        const dateStr = YELLOW(r.timestamp.slice(0, 10));
        const scoreStr = CYAN(`${r.primaryScore}%`.padStart(4));
        const gradeColor = r.grade.startsWith("A") ? GREEN.bold : r.grade.startsWith("B") ? BLUE.bold : YELLOW.bold;
        const gradeBadge = gradeColor(`[${r.grade.padEnd(2)}]`);
        const rcBadge = r.returnCode === "RC=0000" ? GREEN(r.returnCode) : RED(r.returnCode);

        return {
            value: r.id,
            label: `${typeBadge} ${dateStr} ${statusBadge} ${gradeBadge} (${scoreStr}) ${BOLD(r.targetName.slice(0, 26))} [${rcBadge}]`,
        };
    });

    options.push({ value: "BACK", label: `${ICONS.exit} Back` });

    const selectedId = await select({
        message: BOLD(title),
        options,
    });

    if (isCancel(selectedId) || selectedId === "BACK") {
        return;
    }

    const record = getRecordById(selectedId as string);
    if (record) {
        await displayRecordInspection(record);
    }
}

// ─── Filter & Query ───────────────────────────────────────────────────────────

async function filterRecordsFlow(): Promise<void> {
    const filterChoice = await select({
        message: BOLD("Choose Query Criteria:"),
        options: [
            { value: "type_code", label: "Filter: Codebase Projects Only" },
            { value: "type_asgn", label: "Filter: Assignments Only" },
            { value: "status_pass", label: "Filter: Successful Executions (PASS) Only" },
            { value: "status_fail", label: "Filter: Failed / Warning Executions Only" },
            { value: "keyword", label: "Search by Keyword (Repo, Student Z_ID, Name, or Key)" },
            { value: "all", label: "Show All Records" },
        ],
    });

    if (isCancel(filterChoice)) return;

    let filter: VsamQueryFilter = {};

    if (filterChoice === "type_code") {
        filter.executionType = "CODEBASE_PROJECT";
    } else if (filterChoice === "type_asgn") {
        filter.executionType = "ASSIGNMENT";
    } else if (filterChoice === "status_pass") {
        filter.status = "PASS";
    } else if (filterChoice === "status_fail") {
        filter.status = "FAIL";
    } else if (filterChoice === "keyword") {
        const query = await text({
            message: "Enter search keyword:",
            placeholder: "e.g. TYCS, CLI-Tool, Z12413357, A+",
        });
        if (isCancel(query) || !query) return;
        filter.searchKeyword = query as string;
    }

    const filtered = queryRecords(filter);
    console.log(GREEN(`\n  ${ICONS.check} Found ${filtered.length} matching execution records.\n`));
    await browseRecordsFlow(filtered, `Query Results (${filtered.length} records):`);
}

// ─── Deep Record Inspection ───────────────────────────────────────────────────

async function displayRecordInspection(record: MainframeExecutionRecord): Promise<void> {
    while (true) {
        console.log();
        console.log(PURPLE.bold("  ╔══════════════════════════════════════════════════════════════════╗"));
        console.log(PURPLE.bold("  ║  ") + CYAN.bold("VSAM KSDS RECORD INSPECTION: ") + YELLOW.bold(record.id.slice(0, 32)) + PURPLE.bold(" ║"));
        console.log(PURPLE.bold("  ╚══════════════════════════════════════════════════════════════════╝"));
        console.log();

        const isCode = record.executionType === "CODEBASE_PROJECT";
        const typeBadge = isCode ? chalk.bgBlue.black.bold(" CODEBASE PROJECT AUDIT ") : chalk.bgMagenta.black.bold(" ASSIGNMENT AUDIT ");
        const statusBadge = record.status === "PASS" ? chalk.bgGreen.black.bold(" PASS ") : record.status === "SIMULATED" ? chalk.bgYellow.black.bold(" SIMULATED ") : chalk.bgRed.white.bold(" FAIL ");

        // OVERVIEW CARD
        console.log(CYAN("  ╭── [1] EXECUTION OVERVIEW ────────────────────────────────────────╮"));
        console.log(CYAN("  │"));
        console.log(`  │   ${BOLD("Execution Type  :")} ${typeBadge}`);
        console.log(`  │   ${BOLD("VSAM KSDS Key   :")} ${CYAN.bold(record.id)}`);
        console.log(`  │   ${BOLD("Timestamp       :")} ${record.timestamp} ${DIM(`(Julian Date: ${YELLOW(record.julianDate)} ${record.formattedTime})`)}`);
        console.log(`  │   ${BOLD("Engine Mode     :")} ${record.mode === "HERCULES_TK5" ? GREEN.bold("HERCULES TK5 (ONLINE)") : YELLOW.bold("SIMULATED")}`);
        console.log(`  │   ${BOLD("Return Code     :")} ${record.returnCode === "RC=0000" ? GREEN.bold(record.returnCode) : RED.bold(record.returnCode)}  Status: ${statusBadge}`);
        console.log(`  │   ${BOLD("Target Name     :")} ${BOLD(record.targetName)}`);
        console.log(`  │   ${BOLD("Target Path     :")} ${DIM(record.targetPath)}`);
        console.log(`  │   ${BOLD("Scope / Z_ID    :")} ${YELLOW.bold(record.scopeOrZId || "N/A")}`);
        console.log(`  │   ${BOLD("Grade & Score   :")} Grade: ${GREEN.bold(`[ ${record.grade} ]`)} | Score: ${CYAN.bold(record.primaryScore.toString() + "%")} (${BOLD(record.verdict)})`);
        console.log(CYAN("  │"));
        console.log(CYAN("  ╰──────────────────────────────────────────────────────────────────╯"));
        console.log();

        // TELEMETRY CARD
        console.log(PURPLE("  ╭── [2] MAINFRAME PIPELINE TELEMETRY ──────────────────────────────╮"));
        console.log(PURPLE("  │"));
        if (record.telemetry.stages && record.telemetry.stages.length > 0) {
            for (const st of record.telemetry.stages) {
                const sColor = st.status === "PASS" ? GREEN : st.status === "SIMULATED" ? YELLOW : RED;
                console.log(`  │   ${CYAN(st.stage.padEnd(28))} : ${sColor.bold(`RC=${st.returnCode}`)} [${sColor.bold(st.status)}] ${DIM(st.details || "")}`);
            }
        }
        console.log(PURPLE("  │"));
        if (record.telemetry.jobNames && Object.keys(record.telemetry.jobNames).length > 0) {
            const jobsStr = Object.entries(record.telemetry.jobNames)
                .map(([k, v]) => `${k}:${YELLOW(v)}`)
                .join("  ");
            console.log(`  │   ${BOLD("JCL Jobs Generated:")} ${jobsStr}`);
        }
        if (record.telemetry.datasetNames && Object.keys(record.telemetry.datasetNames).length > 0) {
            const dsnStr = Object.entries(record.telemetry.datasetNames)
                .map(([k, v]) => `${k}:${CYAN(v)}`)
                .join("  ");
            console.log(`  │   ${BOLD("Datasets Cataloged:")} ${dsnStr}`);
        }
        console.log(PURPLE("  │"));
        console.log(PURPLE("  ╰──────────────────────────────────────────────────────────────────╯"));
        console.log();

        // DETAILED METRICS CARD
        console.log(BLUE("  ╭── [3] DETAILED METRICS & ARTIFACTS ──────────────────────────────╮"));
        console.log(BLUE("  │"));
        if (isCode && record.codebaseDetails) {
            const cd = record.codebaseDetails;
            console.log(`  │   ${BOLD("Total Files Scanned :")} ${cd.totalFiles}`);
            console.log(`  │   ${BOLD("Files w/ Libraries  :")} ${cd.filesWithImports}`);
            console.log(`  │   ${BOLD("Genuine Usages      :")} ${GREEN.bold(cd.genuineCount.toString())}`);
            console.log(`  │   ${BOLD("Pseudo Usages       :")} ${YELLOW.bold(cd.pseudoCount.toString())}`);
            console.log(`  │   ${BOLD("Duplicate Files     :")} ${cd.duplicateCount > 0 ? RED.bold(cd.duplicateCount.toString()) : GREEN.bold("0 (All Unique)")}`);

            if (cd.technologies && cd.technologies.length > 0) {
                console.log(BLUE("  │"));
                console.log(`  │   ${BOLD("Detected Technologies Breakdown:")}`);
                for (const t of cd.technologies.slice(0, 8)) {
                    console.log(`  │     • ${CYAN(t.technology.padEnd(14))} Total: ${t.total} (Genuine: ${GREEN(t.genuine.toString())}, Pseudo: ${YELLOW(t.pseudo.toString())})`);
                }
            }
        } else if (!isCode && record.assignmentDetails) {
            const ad = record.assignmentDetails;
            console.log(`  │   ${BOLD("Document Format     :")} ${BLUE.bold(ad.fileType)} (${ad.pageCount} pages)`);
            console.log(`  │   ${BOLD("Code Blocks Parsed  :")} ${ad.totalCodeBlocks} (${ad.textBlocks} text, ${ad.ocrBlocks} OCR screenshots)`);
            console.log(`  │   ${BOLD("Requirements Met    :")} ${GREEN.bold(ad.requirementsMet.toString())} / ${CYAN(ad.requirementsTotal.toString())}`);
            console.log(`  │   ${BOLD("Student Identity    :")} ${ad.zIdConsistent ? GREEN.bold("✓ CONSISTENT") : RED.bold("✗ INCONSISTENT")} (${PURPLE(ad.detectedZIds.join(", ") || "None")})`);
            console.log(`  │   ${BOLD("Optimization Grade  :")} ${GREEN.bold(ad.overallOptimizationGrade)}`);
            if (ad.suggestions && ad.suggestions.length > 0) {
                console.log(BLUE("  │"));
                console.log(`  │   ${BOLD("Key Recommendations:")}`);
                for (const s of ad.suggestions.slice(0, 3)) {
                    console.log(`  │     ${YELLOW("•")} ${DIM(s)}`);
                }
            }
        }
        console.log(BLUE("  │"));
        console.log(BLUE("  ╰──────────────────────────────────────────────────────────────────╯"));
        console.log();

        // PHYSICAL VSAM LAYOUT CARD
        console.log(YELLOW("  ╭── [4] PHYSICAL VSAM KSDS RECORD LAYOUT (160 BYTES) ──────────────╮"));
        console.log(YELLOW("  │"));
        console.log(`  │   ${DIM("Offset   Field        Value")}`);
        console.log(`  │   ${CYAN("000-027")}  ${BOLD("VSAM_KEY   :")} ${record.id}`);
        console.log(`  │   ${CYAN("028-031")}  ${BOLD("EXEC_TYPE  :")} ${isCode ? "CODE" : "ASGN"}`);
        console.log(`  │   ${CYAN("032-039")}  ${BOLD("JULIAN     :")} ${record.julianDate}`);
        console.log(`  │   ${CYAN("040-047")}  ${BOLD("TIME       :")} ${record.formattedTime}`);
        console.log(`  │   ${CYAN("048-055")}  ${BOLD("RETCODE    :")} ${record.returnCode}`);
        console.log(`  │   ${CYAN("056-059")}  ${BOLD("GRADE      :")} ${record.grade}`);
        console.log(`  │   ${CYAN("060-063")}  ${BOLD("SCORE      :")} ${String(record.primaryScore).padStart(4, "0")} (${record.primaryScore}%)`);
        console.log(`  │   ${CYAN("064-071")}  ${BOLD("REC_COUNT  :")} ${String(record.recordCount).padStart(8, "0")}`);
        console.log(`  │   ${CYAN("072-079")}  ${BOLD("STATUS     :")} ${record.status}`);
        console.log(`  │   ${CYAN("080-119")}  ${BOLD("TARGET     :")} ${record.targetName}`);
        console.log(`  │   ${CYAN("120-139")}  ${BOLD("SCOPE/ZID  :")} ${record.scopeOrZId}`);
        console.log(YELLOW("  │"));
        console.log(`  │   ${BOLD("RAW 160-BYTE STRING:")}`);
        console.log(`  │   ${INVERSE(record.vsamRecord || "NO RAW RECORD")}`);
        console.log(YELLOW("  │"));
        console.log(YELLOW("  ╰──────────────────────────────────────────────────────────────────╯"));
        console.log();

        const subAction = await select({
            message: "Record actions:",
            options: [
                { value: "view_report", label: `${ICONS.doc} View Formatted Full Audit Report` },
                { value: "delete", label: `${ICONS.error} Delete this Record from VSAM Cluster` },
                { value: "back", label: `${ICONS.exit} Back to Browse List` },
            ],
        });

        if (isCancel(subAction) || subAction === "back") {
            break;
        }

        if (subAction === "view_report") {
            if (record.reportContent) {
                console.log();
                console.log(CYAN.bold("─── FULL AUDIT REPORT ──────────────────────────────────────────"));
                console.log(colorizeReport(record.reportContent));
                console.log(CYAN.bold("────────────────────────────────────────────────────────────────"));
                console.log();
                await text({ message: "Press Enter to return to inspection..." });
            } else {
                console.log(YELLOW(`\n  ${ICONS.warn} No full text report stored for this record.\n`));
                await text({ message: "Press Enter to continue..." });
            }
        } else if (subAction === "delete") {
            const confirmed = await confirm({
                message: `Are you sure you want to delete VSAM record ${record.id}?`,
            });
            if (confirmed && !isCancel(confirmed)) {
                deleteRecord(record.id);
                console.log(GREEN(`\n  ${ICONS.check} Record ${record.id} deleted from VSAM cluster.\n`));
                break;
            }
        }
    }
}

// ─── Cluster Telemetry ────────────────────────────────────────────────────────

async function showClusterTelemetry(): Promise<void> {
    const meta = getClusterMetadata();

    console.log();
    console.log(PURPLE.bold("  ╔══════════════════════════════════════════════════════════════════╗"));
    console.log(PURPLE.bold("  ║  ") + CYAN.bold("VSAM KSDS CLUSTER ARCHITECTURE & STORAGE TELEMETRY") + PURPLE.bold("             ║"));
    console.log(PURPLE.bold("  ╚══════════════════════════════════════════════════════════════════╝"));
    console.log();

    console.log(CYAN("  ╭── CLUSTER ARCHITECTURE: HERC01.AUDIT.HIST.KSDS ──────────────────╮"));
    console.log(CYAN("  │"));
    console.log(`  │   ${BOLD("Cluster Name        :")} ${CYAN.bold(meta.clusterName)}`);
    console.log(`  │   ${BOLD("Data Component      :")} ${meta.dataComponentName}`);
    console.log(`  │   ${BOLD("Index Component     :")} ${meta.indexComponentName}`);
    console.log(`  │   ${BOLD("DASD Volume Serial  :")} ${YELLOW.bold(meta.volumeSerial)} (IBM 3390 Direct Access Device)`);
    console.log(`  │   ${BOLD("Data Set Org (DSORG):")} ${GREEN.bold(meta.organization)}`);
    console.log(`  │   ${BOLD("Primary Key Specs   :")} Offset: ${CYAN("0")}, Length: ${CYAN("28 Bytes")} (Cols 1-28)`);
    console.log(`  │   ${BOLD("Record Length       :")} ${meta.recordSize.average} Bytes Fixed (RECFM=FB, LRECL=160)`);
    console.log(`  │   ${BOLD("Control Interval    :")} ${CYAN("4096 Bytes")} (4KB Standard CI)`);
    console.log(`  │   ${BOLD("Total Active Records:")} ${GREEN.bold(meta.totalRecords.toString())} Records`);
    console.log(`  │   ${BOLD("High-Allocated RBA  :")} ${meta.highAllocatedRba} Bytes`);
    console.log(`  │   ${BOLD("High-Used RBA       :")} ${meta.highUsedRba} Bytes`);
    console.log(`  │   ${BOLD("Last Synced         :")} ${meta.lastUpdated}`);
    console.log(CYAN("  │"));
    console.log(CYAN("  ╰──────────────────────────────────────────────────────────────────╯"));
    console.log();

    console.log(PURPLE("  ╭── STORAGE CONTROL BLOCK DIAGRAM ─────────────────────────────────╮"));
    console.log(PURPLE("  │"));
    console.log(`  │   ${CYAN("┌─────────────────────────────────────────┐")}  ${BOLD("INDEX COMPONENT")}`);
    console.log(`  │   ${CYAN("│ B-TREE SEQUENCE SET & INDEX POINTERS    │")}  Keys: Offset 0, Len 28`);
    console.log(`  │   ${CYAN("│ Free Space: 10% CI / 10% CA             │")}  Primary B-Tree Root`);
    console.log(`  │   ${CYAN("└───────────────────┬─────────────────────┘")}`);
    console.log(`  │                       ${PURPLE("│ Points to Data Control Intervals (4096 B)")}`);
    console.log(`  │                       ${PURPLE("▼")}`);
    console.log(`  │   ${GREEN("┌─────────────────────────────────────────┐")}  ${BOLD("DATA COMPONENT")}`);
    console.log(`  │   ${GREEN("│ CONTROL INTERVAL (CI = 4096 BYTES)      │")}  LRECL: 160 Bytes Fixed`);
    console.log(`  │   ${GREEN("│ [REC 1] [REC 2] [REC 3] ... [RDF] [CIDF]│")}  Max 25 Recs per CI`);
    console.log(`  │   ${GREEN("└─────────────────────────────────────────┘")}  Volume: WORK01 (3390)`);
    console.log(PURPLE("  │"));
    console.log(PURPLE("  ╰──────────────────────────────────────────────────────────────────╯"));
    console.log();

    await text({ message: "Press Enter to return..." });
}

// ─── Live IDCAMS PRINT ────────────────────────────────────────────────────────

async function runLiveIdcamsFlow(): Promise<void> {
    const s = spinner();
    s.start("Submitting IDCAMS PRINT JCL to Hercules TK5 card reader (Port 3505)…");

    const result = await runLiveIdcamsPrint();
    s.stop();

    if (!result.success) {
        console.log(RED(`\n  ${ICONS.error} IDCAMS PRINT Failed: ${result.error || "Unknown error"}\n`));
    } else {
        console.log(GREEN(`\n  ${ICONS.check} IDCAMS PRINT Job Completed on Hercules TK5 with RC=0000!\n`));
        console.log(CYAN.bold("─── HERCULES JES2 SPOOL SYSOUT ────────────────────────────────"));
        console.log(colorizeReport(result.sysout));
        console.log(CYAN.bold("────────────────────────────────────────────────────────────────"));
    }

    await text({ message: "Press Enter to return..." });
}

// ─── Export Records ───────────────────────────────────────────────────────────

async function exportRecordsFlow(records: MainframeExecutionRecord[]): Promise<void> {
    if (records.length === 0) {
        console.log(YELLOW(`\n  ${ICONS.warn} No records to export.\n`));
        await text({ message: "Press Enter to continue..." });
        return;
    }

    const format = await select({
        message: "Choose Export Format:",
        options: [
            { value: "json", label: "JSON (Complete Telemetry & Detail Tree)" },
            { value: "txt", label: "Fixed-Width VSAM (.dat) Physical Records (160 Bytes)" },
            { value: "csv", label: "CSV Summary Table" },
        ],
    });

    if (isCancel(format)) return;

    const defaultFilename = `vsam-history-export-${Date.now()}.${format === "txt" ? "dat" : format}`;
    const filenameInput = await text({
        message: "Export filename:",
        initialValue: defaultFilename,
    });

    if (isCancel(filenameInput) || !filenameInput) return;

    const outPath = path.resolve(process.cwd(), filenameInput as string);

    let content = "";
    if (format === "json") {
        content = JSON.stringify(records, null, 2);
    } else if (format === "txt") {
        content = records.map((r) => r.vsamRecord).join("\n") + "\n";
    } else {
        const header = "ID,TYPE,TIMESTAMP,JULIAN_DATE,TARGET,GRADE,SCORE,RETURN_CODE,STATUS\n";
        const rows = records.map((r) =>
            `"${r.id}","${r.executionType}","${r.timestamp}","${r.julianDate}","${r.targetName}","${r.grade}",${r.primaryScore},"${r.returnCode}","${r.status}"`
        ).join("\n");
        content = header + rows + "\n";
    }

    fs.writeFileSync(outPath, content, "utf-8");
    console.log(GREEN(`\n  ${ICONS.check} Exported ${records.length} records to: ${outPath}\n`));
    await text({ message: "Press Enter to return..." });
}

// ─── Manage Database ──────────────────────────────────────────────────────────

async function manageDatabaseFlow(): Promise<void> {
    const action = await select({
        message: BOLD("Manage Database Records:"),
        options: [
            { value: "clear_all", label: `${ICONS.warn} Clear / Purge All Execution Records` },
            { value: "back", label: `${ICONS.exit} Cancel` },
        ],
    });

    if (isCancel(action) || action === "back") return;

    if (action === "clear_all") {
        const confirmed = await confirm({
            message: "WARNING: This will permanently purge ALL execution history from the VSAM database. Continue?",
        });
        if (confirmed && !isCancel(confirmed)) {
            clearAllRecords();
            console.log(GREEN(`\n  ${ICONS.check} All records purged from VSAM database.\n`));
            await text({ message: "Press Enter to return..." });
        }
    }
}
