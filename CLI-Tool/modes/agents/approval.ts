import type { actionTracker } from "./action_tracker";
import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import type { ActionLog } from "./types";
import { composeBeforeAfter, formatPatch } from "./diff-view";
import { renderTerminalMarkdown } from "../../terminal_ui/terminal_md";

interface ReviewGroup {
    label: string;
    actionIds: string[];
    patch: string | null;
}

function groupPending(pending: ActionLog[]): ReviewGroup[] {
    const byPath = new Map<string, ActionLog[]>();
    const shells: ActionLog[] = [];

    for (const a of pending) {
        if (a.type === "tool_execute") {
            shells.push(a);
            continue;
        }
        const key = a.path;
        if (!byPath.has(key)) byPath.set(key, []);
        byPath.get(key)!.push(a);
    }

    const groups: ReviewGroup[] = [];

    const pathEntries = [...byPath.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
    );
    for (const [p, acts] of pathEntries) {
        const sorted = acts.sort(
            (x, y) => x.timestamp.getTime() - y.timestamp.getTime(),
        );
        const ids = sorted.map((x) => x.id);

        if (sorted.every((x) => x.type === "folder_create")) {
            groups.push({
                label: `Create folder: ${p}`,
                actionIds: ids,
                patch: null,
            });
            continue;
        }

        const { before, after } = composeBeforeAfter(sorted);
        const patch = formatPatch(p, before, after);
        const kinds = [...new Set(sorted.map((x) => x.type))].join(", ");
        groups.push({ label: `${p} (${kinds})`, actionIds: ids, patch });
    }

    for (const s of shells) {
        groups.push({
            label: `Shell: ${s.details.command ?? "(no command)"}`,
            actionIds: [s.id],
            patch: null,
        });
    }

    return groups;
}

export async function runApprovalFlow(tracker: actionTracker): Promise<boolean> {
    const pending = tracker.pendingMutations();
    if (pending.length === 0) {
        console.log(chalk.green("No pending actions to approve!"));
        return false;
    }
    const choice = await select({
        message: "Want to apply the proposed changes?",
        options: [
            { value: "all", label: "Approve and apply all" },
            { value: "select", label: "Review one by one" },
            { value: "cancel", label: "Cancel" },
        ]
    })
    if (isCancel(choice) || choice === "cancel") {
        console.log(chalk.yellow("Aborting, not applying changes."));
        for (const a of pending) {
            tracker.updateStatus(a.id, "rejected", false);
        }
        return false;
    }
    if (choice === "all") {
        for (const a of pending) {
            tracker.updateStatus(a.id, "approved", true);
        }
        return true;
    }
    if (choice === "select") {
        for (const a of pending) {
            tracker.updateStatus(a.id, "rejected", false);
        }
        return false;
    }
    for (const g of groupPending(pending)) {
        while (true) {
            const op = await select({
                message: chalk.bold(g.label),
                options: [
                    { value: "accept", label: "Accept" },
                    { value: "reject", label: "Reject" },
                    { value: "diffs", label: "Show Differences" },
                ]
            })
            if (isCancel(op)) {
                for (const a of pending) {
                    tracker.updateStatus(a.id, "rejected", false);
                    return false;
                }
            }
            if (op === 'diffs') {
                if (g.patch) {
                    console.log(
                        "\n" +
                        renderTerminalMarkdown("```diff\n" + g.patch + "\n```\n") +
                        "\n",
                    );
                }
                continue;
            }
            for (const id of g.actionIds) {
                tracker.updateStatus(
                    id,
                    op === "accept" ? "approved" : "rejected",
                    op === "accept",
                );
            }
            break;
        }
    }
    return tracker.getActions().some((a) => a.status === "approved");
}