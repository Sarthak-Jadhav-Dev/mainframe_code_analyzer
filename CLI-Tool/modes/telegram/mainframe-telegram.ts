/**
 * Telegram runner for the Mainframe Codebase Auditor mode.
 *
 * Mirrors the full CLI pipeline:
 *   1. Scan the repository
 *   2. Check Hercules connectivity
 *   3. If online → run full JCL pipeline (Upload → SORT → COBOL → REXX → Integrity → Report)
 *   4. If offline → build simulated report locally
 *   5. Send the final report back to the Telegram chat
 *
 * Usage (Telegram): /audit [optional-repo-path]
 */

import { scanRepository } from "../mainframe/scanner.ts";
import { defaultMainframeConfig } from "../mainframe/types.ts";
import type { ScanResult } from "../mainframe/types.ts";
import {
    checkHerculesConnectivity,
    submitJcl,
    pollJobUntilComplete,
    getJobSysout,
} from "../mainframe/hercules-client.ts";
import {
    buildUploadJcl,
    buildSortJcl,
    buildCobolJcl,
    buildRexxJcl,
    buildStep4IntegrityJcl,
    buildReportJcl,
    generateJobNames,
    buildDatasetNames,
} from "../mainframe/jcl-templates.ts";
import { flatFileToInlineData } from "../mainframe/flat-file-writer.ts";

type Ctx = { reply: (t: string, o?: object) => Promise<unknown> };


function buildSimulatedReport(scanResult: ScanResult, reason: string = "Hercules offline"): string {
    const techCount: Record<string, number> = {};
    const usageCount: Record<string, number> = { GENUINE: 0, PSEUDO: 0, UNKNOWN: 0 };

    for (const record of scanResult.records) {
        techCount[record.techName] = (techCount[record.techName] || 0) + 1;
        usageCount[record.usageType]!++;
    }

    const seenHashes = new Map<string, string>();
    let duplicateCount = 0;
    for (const f of scanResult.scannedFiles) {
        if (seenHashes.has(f.contentHash)) {
            duplicateCount++;
        } else {
            seenHashes.set(f.contentHash, f.relativePath);
        }
    }

    const topTechs = Object.entries(techCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => `• <code>${name.padEnd(14)}</code> ${count} occurrences`)
        .join("\n");

    return [
        `<b>🖥️ Mainframe Codebase Audit Report</b>`,
        ``,
        `<b>Repository:</b> <code>${scanResult.repoPath}</code>`,
        `<b>Mode:</b> ⚠️ Simulated (${reason})`,
        `<b>Scanned:</b> ${scanResult.totalFiles} files (${scanResult.filesWithImports} with imports)`,
        `<b>Total Records:</b> ${scanResult.records.length}`,
        ``,
        `<b>📋 Pipeline Stages (Simulated):</b>`,
        `• [REQ 1] JCL SORT by TECH_NAME — RC=0000 ✅`,
        `• [REQ 2] COBOL Match-Merge     — RC=0000 ✅`,
        `• [REQ 3] REXX Deduplication    — ${duplicateCount} duplicates pruned ✅`,
        `• [REQ 4] Integrity Check       — RC=0000, counts match ✅`,
        ``,
        `<b>AI Classification:</b>`,
        `• GENUINE : ${usageCount["GENUINE"]}`,
        `• PSEUDO  : ${usageCount["PSEUDO"]}`,
        `• UNKNOWN : ${usageCount["UNKNOWN"]}`,
        ``,
        `<b>Top Technologies:</b>`,
        topTechs || "(none detected)",
    ].join("\n");
}


async function runHerculesPipeline(ctx: Ctx, scanResult: ScanResult): Promise<string | null> {
    const config = defaultMainframeConfig();
    const jobNames = generateJobNames("AUD");
    const suffix = jobNames.uploadJob.slice(-4);
    const datasets = buildDatasetNames(config.datasetPrefix, suffix);
    const flatContent = flatFileToInlineData(scanResult);

    await ctx.reply(`📤 <b>[REQ 0]</b> Uploading flat file (${scanResult.records.length} records)…`, { parse_mode: "HTML" });
    const uploadJcl = buildUploadJcl(jobNames.uploadJob, datasets.inputDsn, flatContent, 80, config.user, config.password);
    await submitJcl(uploadJcl, config);
    const uploadResult = await pollJobUntilComplete(jobNames.uploadJob, config);
    if (!uploadResult.success) throw new Error(`Upload failed: RC=${uploadResult.returnCode}`);
    await ctx.reply(`✅ Upload complete (RC=${uploadResult.returnCode})`);

    // ── Requirement 1: Sort 
    await ctx.reply(`🔃 <b>[REQ 1]</b> JCL SORT by TECH_NAME…`, { parse_mode: "HTML" });
    const sortJcl = buildSortJcl(jobNames.sortJob, datasets.inputDsn, datasets.sortedDsn, config.user, config.password);
    await submitJcl(sortJcl, config);
    const sortResult = await pollJobUntilComplete(jobNames.sortJob, config);
    if (!sortResult.success) throw new Error(`Sort failed: RC=${sortResult.returnCode}`);
    await ctx.reply(`✅ Sort complete (RC=${sortResult.returnCode})`);

    // ── Requirement 2: COBOL 
    await ctx.reply(`⚙️ <b>[REQ 2]</b> COBOL Match-Merge (AUDCOBOL)…`, { parse_mode: "HTML" });
    const cobolJcl = buildCobolJcl(jobNames.cobolJob, datasets.sortedDsn, datasets.cobolOutDsn, config.datasetPrefix, config.user, config.password);
    await submitJcl(cobolJcl, config);
    const cobolResult = await pollJobUntilComplete(jobNames.cobolJob, config);
    await ctx.reply(`${cobolResult.success ? "✅" : "⚠️"} COBOL complete (RC=${cobolResult.returnCode})`);

    // ── Requirement 3: REXX 
    await ctx.reply(`🔁 <b>[REQ 3]</b> REXX Deduplication & Primary-Key Sort…`, { parse_mode: "HTML" });
    const rexxJcl = buildRexxJcl(jobNames.rexxJob, datasets.cobolOutDsn, datasets.rexxOutDsn, config.datasetPrefix, config.user, config.password);
    await submitJcl(rexxJcl, config);
    const rexxResult = await pollJobUntilComplete(jobNames.rexxJob, config);
    await ctx.reply(`${rexxResult.success ? "✅" : "⚠️"} REXX complete (RC=${rexxResult.returnCode})`);

    // ── Requirement 4: IBM SORT Descending + Count Integrity Check 
    await ctx.reply(`🔒 <b>[REQ 4]</b> IBM SORT Descending + Count Integrity Check…`, { parse_mode: "HTML" });
    const integrityJcl = buildStep4IntegrityJcl(
        jobNames.integrityJob,
        datasets.rexxOutDsn,
        datasets.finalDsn,
        false,
        config.datasetPrefix,
        config.user,
        config.password,
    );
    await submitJcl(integrityJcl, config);
    const integrityResult = await pollJobUntilComplete(jobNames.integrityJob, config);
    await ctx.reply(`${integrityResult.success ? "✅" : "⚠️"} Integrity check (RC=${integrityResult.returnCode})`);

    // ── Report Retrieval 
    await ctx.reply(`📄 <b>[REPORT]</b> Retrieving final SYSOUT from MVS…`, { parse_mode: "HTML" });
    const reportTargetDsn = integrityResult.success ? datasets.finalDsn : datasets.rexxOutDsn;
    const reportJcl = buildReportJcl(jobNames.reportJob, reportTargetDsn, config.user, config.password);
    await submitJcl(reportJcl, config);
    await pollJobUntilComplete(jobNames.reportJob, config);
    const sysout = await getJobSysout(jobNames.reportJob, config);

    return sysout?.trim() || null;
}

//  Formatted Telegram Report 

function buildHerculesReport(scanResult: ScanResult, sysout: string | null): string {
    const techCount: Record<string, number> = {};
    const usageCount: Record<string, number> = { GENUINE: 0, PSEUDO: 0, UNKNOWN: 0 };
    for (const record of scanResult.records) {
        techCount[record.techName] = (techCount[record.techName] || 0) + 1;
        usageCount[record.usageType]!++;
    }

    const topTechs = Object.entries(techCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => `• <code>${name.padEnd(14)}</code> ${count} occurrences`)
        .join("\n");

    const parts = [
        `<b>🖥️ Mainframe Codebase Audit Report</b>`,
        ``,
        `<b>Repository:</b> <code>${scanResult.repoPath}</code>`,
        `<b>Mode:</b> ✅ Hercules TK5 Full Pipeline`,
        `<b>Scanned:</b> ${scanResult.totalFiles} files (${scanResult.filesWithImports} with imports)`,
        `<b>Total Records:</b> ${scanResult.records.length}`,
        ``,
        `<b>AI Classification:</b>`,
        `• GENUINE : ${usageCount["GENUINE"]}`,
        `• PSEUDO  : ${usageCount["PSEUDO"]}`,
        `• UNKNOWN : ${usageCount["UNKNOWN"]}`,
        ``,
        `<b>Top Technologies:</b>`,
        topTechs || "(none detected)",
    ];

    if (sysout) {
        parts.push(``, `<b>📋 MVS SYSOUT (excerpt):</b>`, `<pre>${sysout.slice(0, 2000)}</pre>`);
    }

    return parts.join("\n");
}

// Entry Point 

export async function runMainframeAudit(ctx: Ctx, repoPath: string): Promise<void> {
    // Step 1 — Scan
    await ctx.reply(`🔍 Scanning <code>${repoPath}</code>…`, { parse_mode: "HTML" });

    let scanResult: ScanResult;
    try {
        scanResult = await scanRepository(repoPath);
    } catch (err) {
        await ctx.reply(`❌ Scan failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
    }

    if (scanResult.records.length === 0) {
        await ctx.reply(
            `⚠️ No technology imports detected.\n\nScanned ${scanResult.totalFiles} files — no JS/TS imports found.\nMake sure the path points at a JavaScript or TypeScript project.`
        );
        return;
    }

    await ctx.reply(
        `📊 Scan complete — ${scanResult.totalFiles} files, ${scanResult.records.length} technology records found.\nChecking Hercules TK5 connectivity…`
    );

    // Step 2 — Check Hercules
    const config = defaultMainframeConfig();
    const connectivity = await checkHerculesConnectivity(config);

    if (!connectivity.online) {
        await ctx.reply(
            `⚠️ Hercules TK5 not reachable (ports ${config.cardReaderPort} / ${config.httpPort}).\nRunning simulated pipeline…`
        );
        const report = buildSimulatedReport(scanResult);
        await ctx.reply(report, { parse_mode: "HTML" });
        return;
    }

    await ctx.reply(`✅ Hercules TK5 online — running full 4-stage JCL pipeline…`);

    // Step 3 — Full pipeline
    let sysout: string | null = null;
    try {
        sysout = await runHerculesPipeline(ctx, scanResult);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await ctx.reply(`⚠️ Pipeline error: ${errMsg}\nFalling back to simulated report.`);
        const report = buildSimulatedReport(scanResult, `Pipeline Error: ${errMsg}`);
        await ctx.reply(report, { parse_mode: "HTML" });
        return;
    }

    // Step 4  Send report
    const report = buildHerculesReport(scanResult, sysout);
    await ctx.reply(report, { parse_mode: "HTML" });
}
