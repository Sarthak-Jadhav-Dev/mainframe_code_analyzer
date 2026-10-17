/**
 * Telegram runner for the Mainframe Codebase Auditor mode.
 * Runs a scan on the current working directory and sends
 * the report back to the Telegram chat as an HTML message.
 *
 * Usage (Telegram): /audit [optional-repo-path]
 */

import { scanRepository } from "../mainframe/scanner.ts";
import { defaultMainframeConfig } from "../mainframe/types.ts";
import {
    checkHerculesConnectivity,
    submitJcl,
    pollJobUntilComplete,
    getJobSysout,
} from "../mainframe/hercules-client.ts";
import {
    buildUploadJcl,
    buildSortJcl,
    buildReportJcl,
    generateJobNames,
    buildDatasetNames,
} from "../mainframe/jcl-templates.ts";
import { flatFileToInlineData } from "../mainframe/flat-file-writer.ts";
import type { ScanResult } from "../mainframe/types.ts";

type Ctx = { reply: (t: string, o?: object) => Promise<unknown> };

function buildTelegramReport(scanResult: ScanResult, herculesOnline: boolean): string {
    const techCount: Record<string, number> = {};
    const usageCount: Record<string, number> = { GENUINE: 0, PSEUDO: 0, UNKNOWN: 0 };

    for (const record of scanResult.records) {
        techCount[record.techName] = (techCount[record.techName] || 0) + 1;
        usageCount[record.usageType]!++;
    }

    const topTechs = Object.entries(techCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => `• <code>${name.padEnd(12)}</code> ${count} occurrences`)
        .join("\n");

    const modeTag = herculesOnline
        ? "✅ Hercules TK5 pipeline"
        : "⚠️ Simulated (Hercules offline)";

    return [
        `<b>🖥️ Mainframe Codebase Audit Report</b>`,
        ``,
        `<b>Repository:</b> <code>${scanResult.repoPath}</code>`,
        `<b>Mode:</b> ${modeTag}`,
        `<b>Scanned:</b> ${scanResult.totalFiles} files (${scanResult.filesWithImports} with imports)`,
        `<b>Records:</b> ${scanResult.records.length}`,
        ``,
        `<b>Classification:</b>`,
        `• GENUINE : ${usageCount["GENUINE"]}`,
        `• PSEUDO  : ${usageCount["PSEUDO"]}`,
        `• UNKNOWN : ${usageCount["UNKNOWN"]}`,
        ``,
        `<b>Top Technologies:</b>`,
        topTechs || "(none detected)",
    ].join("\n");
}

export async function runMainframeAudit(ctx: Ctx, repoPath: string): Promise<void> {
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

    const config = defaultMainframeConfig();
    const connectivity = await checkHerculesConnectivity(config);

    let herculesOnline = connectivity.online;

    if (herculesOnline) {
        await ctx.reply("✅ Hercules TK5 is online — running full JCL pipeline…");

        try {
            const jobNames = generateJobNames("AUD");
            const suffix = jobNames.uploadJob.slice(-4);
            const datasets = buildDatasetNames(config.datasetPrefix, suffix);
            const flatContent = flatFileToInlineData(scanResult);

            // Upload
            await ctx.reply(`📤 Uploading flat file (${scanResult.records.length} records)…`);
            const uploadJcl = buildUploadJcl(jobNames.uploadJob, datasets.inputDsn, flatContent);
            await submitJcl(uploadJcl, config);
            const uploadResult = await pollJobUntilComplete(jobNames.uploadJob, config);
            if (!uploadResult.success) throw new Error(`Upload failed: RC=${uploadResult.returnCode}`);

            // Sort
            await ctx.reply("🔃 Sorting records by CONTENT_HASH…");
            const sortJcl = buildSortJcl(jobNames.sortJob, datasets.inputDsn, datasets.sortedDsn);
            await submitJcl(sortJcl, config);
            const sortResult = await pollJobUntilComplete(jobNames.sortJob, config);
            if (!sortResult.success) throw new Error(`Sort failed: RC=${sortResult.returnCode}`);

            // Report retrieval
            await ctx.reply("📄 Retrieving report from MVS…");
            const reportJcl = buildReportJcl(jobNames.reportJob, datasets.sortedDsn);
            await submitJcl(reportJcl, config);
            await pollJobUntilComplete(jobNames.reportJob, config);
            const sysout = await getJobSysout(jobNames.reportJob, config);

            if (sysout.trim()) {
                await ctx.reply(
                    `<b>📋 MVS SYSOUT:</b>\n<pre>${sysout.slice(0, 3500)}</pre>`,
                    { parse_mode: "HTML" }
                );
            }
        } catch (err) {
            herculesOnline = false;
            await ctx.reply(`⚠️ Hercules pipeline error: ${err instanceof Error ? err.message : String(err)}\nFalling back to simulated report.`);
        }
    } else {
        await ctx.reply(
            `⚠️ Hercules TK5 not reachable (port ${config.cardReaderPort} or ${config.httpPort}).\nUsing simulated mode.`
        );
    }

    const report = buildTelegramReport(scanResult, herculesOnline);
    await ctx.reply(report, { parse_mode: "HTML" });
}
