import { select, isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { actionTracker } from "./action_tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import {renderTerminalMarkdown} from "../../terminal_ui/terminal_md";
import {runApprovalFlow} from "./approval";

export async function runAgentMode() {
    console.log(chalk.bold("\nAgent Mode is Running\n"));

    const goal = await text({
        message: "What would you like the agent to do?",
        placeholder: "Concrete task for this codebase…",
    });

    if (goal === null || isCancel(goal)) return;


    const config: any = defaultAgentConfig();
    const tracker: any = new actionTracker();
    const executor = new ToolExecutor(tracker, config);
    const tools: any = await createAgentTools(executor);

    const agent = new ToolLoopAgent({
        model: await getAgentModel(),
        stopWhen: stepCountIs(10),
        instructions: [
            `Workspace root: ${config.codebasePath}`,
            "All mutations are staged until approval.",
        ].join("\n"),
        tools,
    })

    const result = await agent.generate({
        prompt: goal.trim(),
        onStepFinish: ({ toolCalls }) => {
            for (const tc of toolCalls) {
                const preview = JSON.stringify(tc.input).slice(0, 160);
                console.log(
                    chalk.green("  ✓"),
                    chalk.bold(String(tc.toolName)),
                    chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
                );
            }
        },
    })
    if (result.text?.trim()){
        console.log(renderTerminalMarkdown(result.text));
    }
    const ok = await runApprovalFlow(tracker);
    if(!ok){
        console.log(chalk.red("Aborting, not applying changes."));
        return executor.clearStaging();
    }

    const {errors} = await executor.applyApprovedFromTracker();
    if(errors.length){
        console.log(chalk.red("\nError applying changes:\n"), errors);
        for(const err of errors){
            console.log(chalk.red("- "+err));
        }
    }else{
        console.log(chalk.green("\n  ✓ Applied\n"));
    }

    executor.clearStaging();

    
}