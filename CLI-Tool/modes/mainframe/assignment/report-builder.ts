/**
 * Assignment Mode — Report Builder
 * ----------------------------------
 * Builds and renders the Assignment Audit Report combining:
 *   - Section 1: Completion Status (AI verdict)
 *   - Section 2: Z_ID Consistency Check
 *   - Section 3: Code Optimization Analysis
 *   - Section 4: Suggestions for Improvement
 *   - Section 5: Mainframe Pipeline Verification (TK5)
 */

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import type { AssignmentAuditReport } from "./types.ts";
import { ICONS } from "../../../terminal_ui/icons.ts";

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

// ─── Plain ASCII Formatting Helpers (for .txt saving) ─────────────────────────

const SEP = "═".repeat(70);
const BOX_TOP = "  ┌" + "─".repeat(66) + "┐";
const BOX_MID = "  ├" + "─".repeat(66) + "┤";
const BOX_BOT = "  └" + "─".repeat(66) + "┘";

function boxLine(content: string, pad = 2): string {
    const maxWidth = 64;
    const padded = " ".repeat(pad) + content;
    const trimmed = padded.length > maxWidth ? padded.slice(0, maxWidth - 3) + "..." : padded;
    return "  │ " + trimmed.padEnd(maxWidth + pad - 2) + " │";
}

function sectionHeader(title: string): string[] {
    return [BOX_TOP, boxLine(title), BOX_MID];
}

// ─── Plain Report Sections (for .txt file saving) ─────────────────────────────

function buildSection1(report: AssignmentAuditReport): string[] {
    const { analysis } = report;
    const { completionVerdict, problemStatementMatchPercent, plagiarismPercentage, requirementsMet, requirementsTotal } = analysis;

    const verdictIcon =
        completionVerdict === "COMPLETED" ? `${ICONS.check} COMPLETED` :
        completionVerdict === "PARTIALLY_COMPLETED" ? `${ICONS.warn} PARTIALLY COMPLETED` :
        `${ICONS.error} INCOMPLETE`;

    return [
        ...sectionHeader("SECTION 1: ASSIGNMENT COMPLETION STATUS"),
        boxLine(`Verdict             : ${verdictIcon}`),
        boxLine(`Problem Match       : ${problemStatementMatchPercent}%`),
        boxLine(`Plagiarism Check    : ${plagiarismPercentage !== undefined ? plagiarismPercentage + "%" : "0%"}`),
        boxLine(`Requirements Met    : ${requirementsMet} / ${requirementsTotal}`),
        BOX_BOT,
    ];
}

function buildSection2(report: AssignmentAuditReport): string[] {
    const { zIdCheck } = report.analysis;
    const consistencyLabel = zIdCheck.consistent
        ? (zIdCheck.found.length > 0 ? `${ICONS.check} CONSISTENT` : `${ICONS.check} VALID (Single Submission)`)
        : `${ICONS.error} INCONSISTENT`;

    const lines = [
        ...sectionHeader("SECTION 2: STUDENT ID / Z_ID CONSISTENCY CHECK"),
        boxLine(`Identities Detected : ${zIdCheck.found.length > 0 ? zIdCheck.found.join(", ") : "Single Submission"}`),
        boxLine(`Consistency         : ${consistencyLabel}`),
        boxLine(`Details             : ${zIdCheck.details.slice(0, 60)}`),
    ];

    if (zIdCheck.details.length > 60) {
        lines.push(boxLine(`                      ${zIdCheck.details.slice(60, 120)}`));
    }

    lines.push(BOX_BOT);
    return lines;
}

function buildSection3(report: AssignmentAuditReport): string[] {
    const { analysis } = report;
    const lines = [
        ...sectionHeader("SECTION 3: CODE OPTIMIZATION ANALYSIS"),
        boxLine(`Overall Grade       : ${analysis.overallOptimizationGrade}`),
        boxLine(`Code Blocks Analyzed: ${analysis.optimizationResults.length}`),
        boxLine(""),
    ];

    for (const opt of analysis.optimizationResults.slice(0, 5)) {
        lines.push(boxLine(`  [Block ${opt.codeBlockIndex + 1}] ${opt.language}`));
        lines.push(boxLine(`    Grade           : ${opt.grade}`));
        lines.push(boxLine(`    Time Complexity : ${opt.timeComplexity}`));
        lines.push(boxLine(`    Space Complexity: ${opt.spaceComplexity}`));
        lines.push(boxLine(`    Code Smells     : ${opt.codeSmells}`));
        for (const issue of opt.issues.slice(0, 2)) {
            lines.push(boxLine(`    ${ICONS.warn} ${issue.slice(0, 58)}`));
        }
        lines.push(boxLine(""));
    }

    lines.push(BOX_BOT);
    return lines;
}

function buildSection4(report: AssignmentAuditReport): string[] {
    const { suggestions } = report.analysis;
    const lines = [
        ...sectionHeader("SECTION 4: SUGGESTIONS FOR IMPROVEMENT"),
    ];

    if (suggestions.length === 0) {
        lines.push(boxLine("No suggestions generated."));
    } else {
        suggestions.slice(0, 8).forEach((s, i) => {
            const prio = s.priority === "HIGH" ? `${ICONS.error}HIGH  ` :
                         s.priority === "MEDIUM" ? `${ICONS.warn}MED   ` :
                         `${ICONS.check}LOW   `;
            lines.push(boxLine(`${i + 1}. [${prio}] [${s.category}]`));
            const desc = s.description;
            for (let j = 0; j < desc.length; j += 58) {
                lines.push(boxLine(`   ${desc.slice(j, j + 58)}`));
            }
            lines.push(boxLine(""));
        });
    }

    lines.push(BOX_BOT);
    return lines;
}

function buildSection5(report: AssignmentAuditReport): string[] {
    const { tk5Verification } = report;
    const lines = [
        ...sectionHeader("SECTION 5: MAINFRAME PIPELINE VERIFICATION (TK5)"),
    ];

    for (const stage of tk5Verification.stages) {
        const statusIcon = stage.status === "PASS" ? ICONS.check :
                           stage.status === "SIMULATED" ? ICONS.warn :
                           ICONS.error;
        lines.push(boxLine(`${stage.stage.padEnd(32)}: RC=${stage.returnCode} ${statusIcon} ${stage.status}`));
        if (stage.status === "FAIL" && stage.details) {
            lines.push(boxLine(`    ↳ ${stage.details.slice(0, 56)}`));
        }
    }

    lines.push(boxLine(""));
    lines.push(boxLine(`Duplicate Blocks Detected : ${tk5Verification.duplicatesFound}`));
    lines.push(boxLine(`Integrity Verified        : ${tk5Verification.integrityVerified ? `${ICONS.check} YES` : `${ICONS.error} NO`}`));
    lines.push(BOX_BOT);
    return lines;
}

// ─── Main Plain Report Builder (for .txt saving) ──────────────────────────────

export function buildAssignmentReport(report: AssignmentAuditReport): string {
    const { documentPath, fileType, pageCount, auditTimestamp, problemStatement, zIds, totalCodeBlocks } = report;

    const lines: string[] = [
        "",
        SEP,
        "  MAINFRAME ASSIGNMENT AUDITOR — ASSIGNMENT EVALUATION REPORT",
        SEP,
        `  Document       : ${path.basename(documentPath)}`,
        `  File Type      : ${fileType.toUpperCase()}`,
        `  Pages          : ${pageCount}`,
        `  Code Blocks    : ${totalCodeBlocks}`,
        `  Z_IDs Detected : ${zIds.length > 0 ? zIds.join(", ") : "None"}`,
        `  Audit Time     : ${auditTimestamp.toISOString()}`,
        `  Problem Stmt   : ${problemStatement.slice(0, 60)}${problemStatement.length > 60 ? "..." : ""}`,
        "",
        ...buildSection1(report),
        "",
        ...buildSection2(report),
        "",
        ...buildSection3(report),
        "",
        ...buildSection4(report),
        "",
        ...buildSection5(report),
        "",
        SEP,
        "  END OF ASSIGNMENT AUDIT REPORT",
        SEP,
        "",
    ];

    return lines.join("\n");
}

// ─── Rich Styled Terminal Renderer (Vibrant Chalk & Theme) ────────────────────

function makeProgressBar(percent: number, width: number = 20): string {
    const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
    const empty = width - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    const color = percent >= 80 ? GREEN : percent >= 60 ? YELLOW : RED;
    return color(`[${bar}] ${percent}%`);
}

/**
 * Renders the Assignment Evaluation Report with high-impact, theme-matched
 * terminal colors, styled cards, and visual indicator badges.
 */
export function displayAssignmentReportTerminal(report: AssignmentAuditReport): void {
    const { documentPath, fileType, pageCount, auditTimestamp, problemStatement, zIds, totalCodeBlocks, analysis, tk5Verification } = report;

    console.log();
    console.log(PURPLE.bold("  ╔══════════════════════════════════════════════════════════════════╗"));
    console.log(PURPLE.bold("  ║  ") + CYAN.bold("MAINFRAME ASSIGNMENT AUDITOR — EVALUATION REPORT") + PURPLE.bold("                ║"));
    console.log(PURPLE.bold("  ║  ") + DIM("AI OCR + Hercules TK5 Mainframe Batch Verification") + PURPLE.bold("             ║"));
    console.log(PURPLE.bold("  ╚══════════════════════════════════════════════════════════════════╝"));
    console.log();

    // Document Telemetry Card
    console.log(`  ${BOLD("📄 Document       :")} ${CYAN.bold(path.basename(documentPath))}`);
    console.log(`  ${BOLD("🏷️  File Type      :")} ${BLUE.bold(fileType.toUpperCase())} ${DIM(`(${pageCount} pages, ${totalCodeBlocks} code blocks)`)}`);
    console.log(`  ${BOLD("🎓 Student Z_IDs  :")} ${zIds.length > 0 ? zIds.map((id) => PURPLE.bold(`[${id}]`)).join(" ") : YELLOW("None Detected")}`);
    console.log(`  ${BOLD("⏱️  Audit Timestamp:")} ${DIM(auditTimestamp.toISOString())}`);
    console.log(`  ${BOLD("🎯 Problem Stmt   :")} ${chalk.italic.dim(`"${problemStatement.slice(0, 75)}${problemStatement.length > 75 ? "..." : ""}"`)}`);
    console.log();

    // SECTION 1: Completion Status
    const verdictBadge =
        analysis.completionVerdict === "COMPLETED" ? chalk.bgGreen.black.bold(" ✓ COMPLETED ") :
        analysis.completionVerdict === "PARTIALLY_COMPLETED" ? chalk.bgYellow.black.bold(" ⚠ PARTIALLY COMPLETED ") :
        chalk.bgRed.white.bold(" ✗ INCOMPLETE ");

    console.log(CYAN("  ╭── [1] ASSIGNMENT COMPLETION STATUS ──────────────────────────────╮"));
    console.log(CYAN("  │"));
    console.log(`  │   ${BOLD("Completion Verdict:")} ${verdictBadge}`);
    console.log(`  │   ${BOLD("Problem Match     :")} ${makeProgressBar(analysis.problemStatementMatchPercent, 20)}`);
    console.log(`  │   ${BOLD("Plagiarism Check  :")} ${analysis.plagiarismPercentage !== undefined && analysis.plagiarismPercentage > 0 ? RED(`${analysis.plagiarismPercentage}%`) : GREEN("0% (Clean Submission)")}`);
    console.log(`  │   ${BOLD("Requirements Met  :")} ${GREEN.bold(analysis.requirementsMet.toString())} / ${CYAN(analysis.requirementsTotal.toString())} Requirements Satisfied`);
    console.log(CYAN("  │"));
    console.log(CYAN("  ╰──────────────────────────────────────────────────────────────────╯"));
    console.log();

    // SECTION 2: Student Z_ID Consistency
    const zConsistentBadge = analysis.zIdCheck.consistent
        ? chalk.bgGreen.black.bold(" ✓ CONSISTENT ")
        : chalk.bgRed.white.bold(" ✗ INCONSISTENT ");

    console.log(PURPLE("  ╭── [2] STUDENT IDENTITY & Z_ID AUDIT ─────────────────────────────╮"));
    console.log(PURPLE("  │"));
    console.log(`  │   ${BOLD("Identities Detected:")} ${zIds.length > 0 ? zIds.map((id) => PURPLE.bold(id)).join(", ") : DIM("Single Submission")}`);
    console.log(`  │   ${BOLD("Consistency Audit  :")} ${zConsistentBadge} ${analysis.zIdCheck.consistent ? GREEN("(Single Author Verified)") : RED("(Potential Multiple Authors)")}`);
    console.log(`  │   ${BOLD("Audit Remarks      :")} ${DIM(analysis.zIdCheck.details)}`);
    console.log(PURPLE("  │"));
    console.log(PURPLE("  ╰──────────────────────────────────────────────────────────────────╯"));
    console.log();

    // SECTION 3: Code Optimization Analysis
    const gradeColor =
        analysis.overallOptimizationGrade.startsWith("A") ? chalk.bgGreen.black.bold :
        analysis.overallOptimizationGrade.startsWith("B") ? chalk.bgBlue.black.bold :
        analysis.overallOptimizationGrade.startsWith("C") ? chalk.bgYellow.black.bold :
        chalk.bgRed.white.bold;

    console.log(BLUE("  ╭── [3] CODE OPTIMIZATION & STATIC ANALYSIS ───────────────────────╮"));
    console.log(BLUE("  │"));
    console.log(`  │   ${BOLD("Overall Grade       :")} ${gradeColor(` ${analysis.overallOptimizationGrade} `)} ${DIM(`(Across ${analysis.optimizationResults.length} Code Blocks)`)}`);
    console.log(BLUE("  │"));

    for (const opt of analysis.optimizationResults.slice(0, 6)) {
        const blkGrade = opt.grade.startsWith("A") ? GREEN.bold(`[${opt.grade}]`) :
                         opt.grade.startsWith("B") ? BLUE.bold(`[${opt.grade}]`) :
                         YELLOW.bold(`[${opt.grade}]`);

        console.log(`  │   ${BOLD(`• [Block ${opt.codeBlockIndex + 1}]`)} ${CYAN.bold(opt.language)}  Grade: ${blkGrade}  Time: ${YELLOW(opt.timeComplexity)}  Space: ${GREEN(opt.spaceComplexity)}`);
        if (opt.codeSmells > 0) {
            console.log(`  │     ↳ ${RED(`${opt.codeSmells} code smell(s) detected`)}`);
        }
        for (const issue of opt.issues.slice(0, 2)) {
            console.log(`  │     ↳ ${YELLOW("⚠")} ${DIM(issue.slice(0, 60))}`);
        }
    }
    console.log(BLUE("  │"));
    console.log(BLUE("  ╰──────────────────────────────────────────────────────────────────╯"));
    console.log();

    // SECTION 4: Improvement Suggestions
    console.log(YELLOW("  ╭── [4] ACTIONABLE IMPROVEMENT SUGGESTIONS ────────────────────────╮"));
    console.log(YELLOW("  │"));

    if (analysis.suggestions.length === 0) {
        console.log(`  │   ${GREEN("✓ No major optimizations needed — code implementation meets standards.")}`);
    } else {
        analysis.suggestions.slice(0, 6).forEach((s, i) => {
            const prioBadge =
                s.priority === "HIGH" ? chalk.bgRed.white.bold(" HIGH ") :
                s.priority === "MEDIUM" ? chalk.bgYellow.black.bold(" MED  ") :
                chalk.bgBlue.white.bold(" LOW  ");

            console.log(`  │   ${prioBadge} ${MAGENTA.bold(`[${s.category}]`)} ${BOLD(`Suggestion #${i + 1}`)}`);
            console.log(`  │          ${DIM(s.description.slice(0, 68))}`);
            if (s.description.length > 68) {
                console.log(`  │          ${DIM(s.description.slice(68, 136))}`);
            }
        });
    }
    console.log(YELLOW("  │"));
    console.log(YELLOW("  ╰──────────────────────────────────────────────────────────────────╯"));
    console.log();

    // SECTION 5: Mainframe Pipeline Verification (TK5)
    console.log(GREEN("  ╭── [5] HERCULES TK5 MAINFRAME PIPELINE VERIFICATION ──────────────╮"));
    console.log(GREEN("  │"));

    for (const stage of tk5Verification.stages) {
        const rcColor = stage.returnCode === "0000" ? GREEN.bold : RED.bold;
        const statusBadge =
            stage.status === "PASS" ? GREEN.bold("✓ PASS") :
            stage.status === "SIMULATED" ? YELLOW.bold("⚠ SIMULATED") :
            RED.bold("✗ FAIL");

        console.log(`  │   ${CYAN(stage.stage.padEnd(28))} : ${rcColor(`RC=${stage.returnCode}`)} ${statusBadge} ${DIM(stage.details ? `— ${stage.details.slice(0, 32)}` : "")}`);
    }

    console.log(GREEN("  │"));
    console.log(`  │   ${BOLD("Duplicate Blocks Removed :")} ${tk5Verification.duplicatesFound > 0 ? YELLOW(tk5Verification.duplicatesFound.toString()) : GREEN("0 (All Unique)")}`);
    console.log(`  │   ${BOLD("Data Integrity Verified  :")} ${tk5Verification.integrityVerified ? GREEN.bold("✓ YES (Count Exact Match)") : RED.bold("✗ MISMATCH")}`);
    console.log(GREEN("  │"));
    console.log(GREEN("  ╰──────────────────────────────────────────────────────────────────╯"));
    console.log();
}

/**
 * Save the report to a .txt file. Returns the saved file path.
 */
export function saveReportToFile(reportText: string, docPath: string): string {
    const basename = path.basename(docPath, path.extname(docPath));
    const datePart = new Date().toISOString().slice(0, 10);
    const fileName = `assignment-audit-${basename}-${datePart}.txt`;
    const outPath = path.resolve(process.cwd(), fileName);
    fs.writeFileSync(outPath, reportText, "utf-8");
    return outPath;
}
