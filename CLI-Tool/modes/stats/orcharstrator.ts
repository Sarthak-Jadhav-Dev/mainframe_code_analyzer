import chalk from "chalk"
import {select,isCancel,spinner} from "@clack/prompts"
import { listApiKeys } from "./handler"

const s = spinner()

export async function runStateModes(){
    console.log(chalk.bgWhite("GET DATA FROM OPENROUTER"))
    const selectMode = await select({
        message:chalk.bold("What you want to do? "),
        options:[
            {value:"list",label:chalk.cyan("List API-Keys")},
        ]
    })
    if(selectMode===null || isCancel(selectMode)){
        console.log(chalk.red("❌ Operation Cancelled"))
        return;
    }
    if(selectMode==="list"){
        s.start('Listing API Keys')
        await listApiKeys()
        s.stop();
    }
}
