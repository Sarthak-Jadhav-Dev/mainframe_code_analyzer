import { select,isCancel,text } from "@clack/prompts";
import { OpenRouter } from "@openrouter/sdk";
import chalk from "chalk";

const openrouter = new OpenRouter({
    apiKey:process.env.management_key
})

export async function listApiKeys(){
    const keys = await openrouter.apiKeys.list()
    const arrayOfApiKeys = keys.data;
    const results = (arrayOfApiKeys:any):void =>{
        arrayOfApiKeys.forEach((element:any,indexes:number)=>{
            console.log(chalk.bgCyan("\n-------GENERAL DATA-------"))
            console.log(chalk.cyan(`API Key No. ${indexes+1}`));
            console.log(chalk.yellow("Created At ")+ element.createdAt);
            console.log(chalk.yellow("Updated At ")+ (element.updatedAt ?? "N/A"));
            console.log(chalk.yellow("Hash Key ")+ element.hash);
            console.log(chalk.yellow("Name ")+ element.name);
            console.log(chalk.cyan("-------USAGE DATA-------"));
            console.log(chalk.yellow("Usage ")+ element.usage);
            console.log(chalk.yellow("Usage Daily ")+ (element.usageDaily ?? 0));
            console.log(chalk.yellow("Usage Weekly ")+ (element.usageWeekly ?? 0));
            console.log(chalk.yellow("Usage Monthly ")+ (element.usageMonthly ?? 0));
            console.log(chalk.bgCyan("--------------------------"))
        })
    }
    results(arrayOfApiKeys);
    return;   
}