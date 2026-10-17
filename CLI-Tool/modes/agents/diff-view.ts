import { createTwoFilesPatch } from "diff";
import type { ActionLog } from "./types";

export function formatPatch(path: string, before: string, after: string): string {
    return createTwoFilesPatch(
        path,
        path,
        before,
        after,
        "",
        "",
        { context: 3 }
    );
}

export function composeBeforeAfter(sorted: ActionLog[]): {
    before: string,
    after: string
} {
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    if (last.type === "file_delete"){
        return { before: last.details.before ?? "", after: "" };
    }
    const before = first.type === "file_create" ? "" : (first.details.before ?? "");
    const after = last.details.after ?? "";
    return { before, after };
}