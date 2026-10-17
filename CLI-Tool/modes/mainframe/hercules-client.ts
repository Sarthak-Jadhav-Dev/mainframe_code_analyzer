/**
 * Mainframe Codebase Auditor — Hercules TK5 Client
 * --------------------------------------------------
 * Handles all communication with the Hercules TK5 mainframe emulator.
 *
 * Port Configuration (VERIFIED from HERCULES_PORTS_GUIDE.md):
 *   Port 3505 — Card Reader (JCL submission via TCP socket)  ✅
 *   Port 8038 — HTTP Console (job status / syslog polling)   ✅
 *   Port 3270 — TN3270 Terminal (not used by this client)
 *
 * JCL Submission (Port 3505):
 *   - Raw TCP socket connection
 *   - JCL sent as ASCII, must end with \n/*\n
 *   - No response from server on success
 *
 * Job Status (Port 8038):
 *   - HTTP GET to /cgi-bin/tasks/syslog
 *   - Look for $HASP373 jobname = started
 *   - Look for $HASP395 jobname = ended
 *   - Parse RC=XXXX for return code
 */

import net from "node:net";
import fs from "node:fs";
import type { MainframeConfig, JobResult } from "./types.ts";

// ─── TCP JCL Submission ───────────────────────────────────────────────────────

/**
 * Submit JCL to Hercules card reader via TCP socket on port 3505.
 * The JCL is sent as ASCII. An extra `\n/*\n` is appended automatically.
 */
export function submitJcl(
    jcl: string,
    config: MainframeConfig,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.setTimeout(15000);

        client.connect(config.cardReaderPort, config.host, () => {
            // JCL MUST end with /* on a line by itself
            const payload = jcl.trim() + "\n/*\n";
            client.write(payload, "ascii", () => {
                client.end();
            });
        });

        client.on("error", (err) => {
            reject(new Error(`Card reader connection failed (${config.host}:${config.cardReaderPort}): ${err.message}`));
        });

        client.on("timeout", () => {
            client.destroy();
            reject(new Error(`Card reader connection timed out after 15s`));
        });

        client.on("close", () => {
            resolve();
        });
    });
}

// ─── HTTP Console Polling ─────────────────────────────────────────────────────

const SYSLOG_URL = (cfg: MainframeConfig) =>
    `http://${cfg.host}:${cfg.httpPort}/cgi-bin/tasks/syslog`;

/**
 * Fetch the current system log from the Hercules HTTP console.
 * The syslog contains JES2 messages for all running and completed jobs.
 */
async function fetchSyslog(config: MainframeConfig): Promise<string> {
    const url = SYSLOG_URL(config);
    const resp = await fetch(url, {
        signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
        throw new Error(`Syslog request failed: HTTP ${resp.status} from ${url}`);
    }
    return resp.text();
}

export interface MvsJobStatus {
    started: boolean;
    completed: boolean;
    returnCode?: number;
    hasJclError: boolean;
    isFlushed: boolean;
    hasAbend: boolean;
    abendCode?: string;
    isCancelled: boolean;
    errorDetail?: string;
}

/**
 * Query the status of a job by parsing the system log.
 * Detects JCL errors (IEF452I/IEF453I), ABENDs, FLUSH, CANCEL, and return codes.
 */
async function queryJobStatus(
    jobName: string,
    config: MainframeConfig,
): Promise<MvsJobStatus> {
    const log = await fetchSyslog(config);
    const upper = log.toUpperCase();
    const name = jobName.toUpperCase();

    const started = upper.includes(`$HASP373 ${name}`) || upper.includes(`IEF403I ${name}`);
    const completed = upper.includes(`$HASP395 ${name}`) || upper.includes(`IEF404I ${name}`) || upper.includes(`IEF452I ${name}`);

    let hasJclError = false;
    let isFlushed = false;
    let hasAbend = false;
    let abendCode: string | undefined;
    let isCancelled = false;
    let errorDetail: string | undefined;
    let returnCode: number | undefined;

    // Check for JCL / Converter / Allocation errors
    if (
        upper.includes(`IEF452I ${name}`) ||
        upper.includes(`IEF453I ${name}`) ||
        (upper.includes(name) && upper.includes("JCL ERROR")) ||
        (upper.includes(name) && upper.includes("RAKF0005"))
    ) {
        hasJclError = true;
        errorDetail = "MVS JCL Error: Job failed during JCL parsing or dataset/device allocation (IEF452I/IEF453I)";
    }

    // Check for Cancellation
    if (upper.includes(`IEF251I ${name}`) || (upper.includes(name) && upper.includes("JOB CANCELLED"))) {
        isCancelled = true;
        errorDetail = "MVS Job Cancelled by operator or system";
    }

    // Check for Step Flush
    if (upper.includes(name) && upper.includes("*FLUSH*")) {
        isFlushed = true;
        if (!errorDetail) {
            errorDetail = "MVS Step Flushed: Prior condition code or allocation failure caused step flush";
        }
    }

    // Check for ABEND
    const abendMatch = upper.match(new RegExp(`${name}[\\s\\S]*?AB(?:END)?\\s*(?:S\\d+\\s*)?([US][0-9A-F]{3,4})`));
    if (abendMatch || (upper.includes(name) && upper.includes("ABEND"))) {
        hasAbend = true;
        abendCode = abendMatch ? abendMatch[1] : undefined;
        errorDetail = `MVS ABEND${abendCode ? ` (${abendCode})` : ""}: Program terminated abnormally`;
    }

    // Check for Return Code: e.g. "NAME STEP01 PROG RC= 0000" or "NAME ... RC=0000"
    const rcRegex = new RegExp(`${name}[\\s\\S]*?RC=\\s*(\\d{1,4})`, "g");
    const matches = [...upper.matchAll(rcRegex)];
    if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        if (lastMatch && lastMatch[1]) {
            returnCode = parseInt(lastMatch[1], 10);
        }
    }

    // If job ended normally (IEF404I) and had no RC explicitly found (e.g. IEFBR14) and no errors:
    if (returnCode === undefined && upper.includes(`IEF404I ${name}`) && !hasJclError && !hasAbend && !isFlushed) {
        returnCode = 0;
    }

    return {
        started,
        completed,
        returnCode,
        hasJclError,
        isFlushed,
        hasAbend,
        abendCode,
        isCancelled,
        errorDetail,
    };
}

/**
 * Poll Hercules until a job completes or the timeout is reached.
 */
export async function pollJobUntilComplete(
    jobName: string,
    config: MainframeConfig,
    onProgress?: (attempt: number, maxAttempts: number, status: string) => void,
): Promise<JobResult> {
    const { pollMaxAttempts, pollIntervalMs } = config;

    for (let attempt = 1; attempt <= pollMaxAttempts; attempt++) {
        let status: MvsJobStatus;

        try {
            status = await queryJobStatus(jobName, config);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            onProgress?.(attempt, pollMaxAttempts, `poll error: ${msg}`);

            if (attempt === pollMaxAttempts) {
                return {
                    success: false,
                    jobName,
                    error: `Syslog polling failed: ${msg}`,
                    attempts: attempt,
                    totalTimeMs: attempt * pollIntervalMs,
                };
            }

            await sleep(pollIntervalMs);
            continue;
        }

        const statusStr = status.completed
            ? (status.hasJclError
                ? "FAILED (JCL ERROR)"
                : status.hasAbend
                ? `FAILED (ABEND ${status.abendCode || ""})`
                : status.isCancelled
                ? "CANCELLED"
                : status.isFlushed
                ? "FLUSHED"
                : `COMPLETE (RC=${status.returnCode ?? "?"})`)
            : status.started
            ? "RUNNING"
            : "WAITING";

        onProgress?.(attempt, pollMaxAttempts, statusStr);

        if (status.completed) {
            const isSuccess = !status.hasJclError &&
                !status.hasAbend &&
                !status.isCancelled &&
                !status.isFlushed &&
                (status.returnCode !== undefined && status.returnCode <= 4);

            return {
                success: isSuccess,
                jobName,
                returnCode: status.returnCode,
                error: isSuccess ? undefined : (status.errorDetail || `Job ended with RC=${status.returnCode ?? "UNKNOWN"}`),
                attempts: attempt,
                totalTimeMs: attempt * pollIntervalMs,
            };
        }

        await sleep(pollIntervalMs);
    }

    return {
        success: false,
        jobName,
        error: `Job '${jobName}' did not complete within ${pollMaxAttempts} attempts (${(pollMaxAttempts * pollIntervalMs) / 1000}s)`,
        attempts: pollMaxAttempts,
        totalTimeMs: pollMaxAttempts * pollIntervalMs,
    };
}

/**
 * Retrieve SYSOUT from the system log or Hercules printer file for a specific job.
 */
export async function getJobSysout(
    jobName: string,
    config: MainframeConfig,
): Promise<string> {
    const name = jobName.toUpperCase();

    // 1. Check local printer file if available (contains true dataset listings)
    if (config.printerPath && fs.existsSync(config.printerPath)) {
        try {
            const prtContent = await fs.promises.readFile(config.printerPath, "utf-8");
            const prtUpper = prtContent.toUpperCase();
            if (prtUpper.includes(name)) {
                const jobIdx = prtUpper.lastIndexOf(name);
                const slice = prtContent.slice(Math.max(0, jobIdx - 300), jobIdx + 4000);
                const lines = slice.split("\n").filter((l) => l.trim().length > 0);
                if (lines.length > 5) {
                    return lines.join("\n");
                }
            }
        } catch {
            // fallback to syslog
        }
    }

    // 2. Syslog extraction
    const log = await fetchSyslog(config);
    const lines = log.split("\n");

    const output: string[] = [];
    let inJob = false;

    for (const line of lines) {
        const upper = line.toUpperCase();
        if (upper.includes(`$HASP373 ${name}`) || upper.includes(`$HASP100 ${name}`)) {
            inJob = true;
        }
        if (inJob) {
            output.push(line);
        }
        if (upper.includes(`$HASP395 ${name}`)) {
            break;
        }
    }

    return output.join("\n");
}

// ─── Connectivity Check ───────────────────────────────────────────────────────

/**
 * Check if the Hercules card reader (port 3505) is reachable.
 * Returns true if connection succeeds within 3 seconds.
 */
export function checkCardReaderReachable(config: MainframeConfig): Promise<boolean> {
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(3000);

        client.connect(config.cardReaderPort, config.host, () => {
            client.destroy();
            resolve(true);
        });

        client.on("error", () => resolve(false));
        client.on("timeout", () => {
            client.destroy();
            resolve(false);
        });
    });
}

/**
 * Check if the Hercules HTTP console (port 8038) is reachable.
 */
export async function checkHttpConsoleReachable(config: MainframeConfig): Promise<boolean> {
    try {
        const resp = await fetch(`http://${config.host}:${config.httpPort}/`, {
            signal: AbortSignal.timeout(3000),
        });
        return resp.ok || resp.status < 500;
    } catch {
        return false;
    }
}

/**
 * Full connectivity check — tests both ports.
 */
export async function checkHerculesConnectivity(config: MainframeConfig): Promise<{
    cardReader: boolean;
    httpConsole: boolean;
    online: boolean;
}> {
    const [cardReader, httpConsole] = await Promise.all([
        checkCardReaderReachable(config),
        checkHttpConsoleReachable(config),
    ]);

    return {
        cardReader,
        httpConsole,
        online: cardReader && httpConsole,
    };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}
