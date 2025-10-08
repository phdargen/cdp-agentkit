/**
 * Main exports for the CDP ADK-TS package
 */

import { createTool } from "@iqai/adk";
import type { BaseTool } from "@iqai/adk";
import { AgentKit, type Action } from "@coinbase/agentkit";

export type AdkTool = BaseTool;

/**
 * Get ADK-TS tools from an AgentKit instance
 *
 * @param agentKit - The AgentKit instance
 * @returns An array of ADK BaseTool instances
 */
export function getAdkTools(agentKit: AgentKit): BaseTool[] {
  const actions: Action[] = agentKit.getActions();
  const tools: BaseTool[] = [];
  
  for (const action of actions) {
    // Don't pass schema - there's a Zod v3/v4 incompatibility
    // The tool will work without explicit schema validation
    const tool = createTool({
      name: action.name,
      description: action.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fn: async (args: any) => {
        return await action.invoke(args);
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    tools.push(tool);
  }
  
  return tools;
}
