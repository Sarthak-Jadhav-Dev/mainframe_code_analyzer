export type ActionType =| 'file_create'| 'file_modify'| 'file_delete'| 'folder_create'| 'code_analysis'| 'tool_execute';

export type ActionStatus = 'pending' | 'executed' | 'approved' | 'rejected';

export interface ActionLog {
  id: string;
  timestamp: Date;
  type: ActionType;
  path: string;
  details: {
    before?: string;
    after?: string;
    toolName?: string;
    toolResult?: string;
    error?: string;
    command?: string;
  };
  status: ActionStatus;
  userApproved?: boolean;
}
//this will save the history of actions taken by the agent, including file modifications, tool executions, and their outcomes. It will also track whether actions were approved or rejected by the user, allowing for better transparency and control over the agent's behavior.

export interface AgentConfig {
  codebasePath: string;
  maxFileSizeToRead: number;
  excludePatterns: string[];
  tools: {
    allowShellExecution: boolean;
    allowFileModification: boolean;
    allowFileCreation: boolean;
    allowFolderCreation: boolean;
  };
}
//this will define the configuration for the agent, including the path to the codebase it will operate on, maximum file size it can read, patterns to exclude from its operations, and permissions for various tools and actions it can perform.

export const defaultAgentConfig = (): AgentConfig => ({
  codebasePath: process.cwd(),
  maxFileSizeToRead: 1024 * 1024 ,
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '*.log',
    '.env*',
  ],
  tools: {
    allowShellExecution: true,
    allowFileModification: true,
    allowFileCreation: true,
    allowFolderCreation: true,
  },
});

export function isMutationType(t: ActionType): boolean {
  return (
    t === 'file_create' ||
    t === 'file_modify' ||
    t === 'file_delete' ||
    t === 'folder_create' ||
    t === 'tool_execute'
  );
}
//this means we can use this function to check if a given action type is a mutation type, which involves changes to the file system or execution of tools. This can help us determine whether an action requires user approval or additional scrutiny before being executed.