/**
 * Assignment Mode — Report Builder
 * ----------------------------------
 * Builds the final Assignment Audit Report combining:
 *   - Section 1: Completion Status (AI verdict)
 *   - Section 2: Z_ID Consistency Check
 *   - Section 3: Code Optimization Analysis
 *   - Section 4: Suggestions for Improvement
 *   - Section 5: Mainframe Pipeline Verification (TK5)
 */

import fs from "node:fs";
import path from "node:path";
import type { AssignmentAuditReport } from "./types.ts";
import { ICONS } from "../../../terminal_ui/icons.ts";

// ─── Formatting Helpers ───────────────────────────────────────────────────────

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

// ─── Report Sections ─────────────────────────────────────────────────────────

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
            // Wrap description to 58 chars per line
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
    }

    lines.push(boxLine(""));
    lines.push(boxLine(`Duplicate Blocks Detected : ${tk5Verification.duplicatesFound}`));
    lines.push(boxLine(`Integrity Verified        : ${tk5Verification.integrityVerified ? `${ICONS.check} YES` : `${ICONS.error} NO`}`));
    lines.push(BOX_BOT);
    return lines;
}

// ─── Main Report Builder ──────────────────────────────────────────────────────

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
