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

/**
 * Query the status of a job by parsing the system log.
 * Returns { started, completed, returnCode }.
 */
async function queryJobStatus(
    jobName: string,
    config: MainframeConfig,
): Promise<{ started: boolean; completed: boolean; returnCode?: number }> {
    const log = await fetchSyslog(config);
    const upper = log.toUpperCase();
    const name = jobName.toUpperCase();

    const completed = upper.includes(`$HASP395 ${name}`);
    const started = upper.includes(`$HASP373 ${name}`);

    let returnCode: number | undefined;
    if (completed) {
        // Try pattern: RC=NNNN on the same line as the job name
        const rcPattern = new RegExp(`${name}.*RC=(\\d{4})`);
        const globalRcPattern = /RC=(\d{4})/g;
        let match = log.match(rcPattern);
        if (!match) {
            // Fallback: grab last RC= in log
            const all = [...log.matchAll(globalRcPattern)];
            if (all.length > 0) {
                match = all[all.length - 1] as RegExpMatchArray;
            }
        }
        if (match) {
            returnCode = parseInt(match[1]!, 10);
        } else {
            returnCode = 0; // assume success if RC not found
        }
    }

    return { started, completed, returnCode };
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
        let status: { started: boolean; completed: boolean; returnCode?: number };

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
            ? `COMPLETE (RC=${status.returnCode ?? "?"})`
            : status.started
            ? "RUNNING"
            : "WAITING";

        onProgress?.(attempt, pollMaxAttempts, statusStr);

        if (status.completed) {
            return {
                success: (status.returnCode ?? 0) <= 4, // RC 0-4 = success in MVS
                jobName,
                returnCode: status.returnCode,
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
 * Retrieve SYSOUT from the system log for a specific job.
 * Extracts lines between $HASP373 (start) and $HASP395 (end).
 */
export async function getJobSysout(
    jobName: string,
    config: MainframeConfig,
): Promise<string> {
    const log = await fetchSyslog(config);
    const name = jobName.toUpperCase();
    const lines = log.split("\n");

    const output: string[] = [];
    let inJob = false;

    for (const line of lines) {
        const upper = line.toUpperCase();
        if (upper.includes(`$HASP373 ${name}`)) {
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
