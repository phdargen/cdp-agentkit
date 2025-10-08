# Agentkit Extension - ADK-TS

ADK-TS extension of AgentKit. Enables agentic workflows to interact with onchain actions using the Agent Development Kit for TypeScript.

## What is ADK-TS?

Agent Development Kit (ADK) for TypeScript is a powerful framework for building, orchestrating, and deploying AI agents. This extension allows you to use AgentKit's blockchain capabilities with ADK-TS's advanced workflow orchestration, including:

- **LangGraph Agents**: Complex workflows with conditional branching and state management
- **Sequential Agents**: Execute agents one after another
- **Parallel Agents**: Run multiple agents simultaneously
- **Loop Agents**: Iterative refinement until conditions are met

Learn more at [https://adk.iqai.com/](https://adk.iqai.com/)

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- Node.js 18 or higher
- ADK-TS installed (`npm install @iqai/adk`)

### Installation

```bash
npm install @coinbase/agentkit-iqai-adk @coinbase/agentkit @iqai/adk
```

### Environment Setup

Set the following environment variables:

```bash
export CDP_API_KEY_ID=<your-cdp-api-key-id>
export CDP_API_KEY_SECRET=<your-cdp-api-key-secret>
export CDP_WALLET_SECRET=<your-wallet-secret>
```

## Usage

### Basic Setup

```typescript
import { getAdkTools } from "@coinbase/agentkit-iqai-adk";
import { LlmAgent } from "@iqai/adk";
import { AgentKit, CdpEvmWalletProvider } from "@coinbase/agentkit";

// Initialize AgentKit with a wallet provider
const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
  networkId: "base-sepolia",
});

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [/* your action providers */],
});

// Convert AgentKit actions to ADK-TS tools
const tools = getAdkTools(agentKit);

// Create an ADK-TS agent with blockchain capabilities
const agent = new LlmAgent({
  name: "blockchain-agent",
  model: "gemini-2.5-flash",
  tools,
  instruction: "You are a helpful blockchain agent that can interact onchain.",
});

// Use the agent
const result = await agent.run({ message: "What's my wallet balance?" });
```

### Multi-Network Agent with State Management

```typescript
import { getAdkTools } from "@coinbase/agentkit-iqai-adk";
import { LangGraphAgent, LlmAgent } from "@iqai/adk";
import { AgentKit, CdpEvmWalletProvider } from "@coinbase/agentkit";

// Create agents for different networks
async function createNetworkAgent(networkId: string) {
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId,
  });

  const agentKit = await AgentKit.from({
    walletProvider,
    actionProviders: [/* your providers */],
  });

  const tools = getAdkTools(agentKit);

  return new LlmAgent({
    name: `${networkId}-agent`,
    model: "gemini-2.5-flash",
    tools,
    instruction: `You handle ${networkId} network operations.`,
  });
}

// Setup multi-network workflow
const baseAgent = await createNetworkAgent("base-sepolia");
const ethereumAgent = await createNetworkAgent("ethereum-mainnet");

// Create stateful workflow with network switching
const multiNetworkAgent = new LangGraphAgent({
  name: "multi-network-agent",
  description: "Agent that can switch between blockchain networks",
  // ... workflow configuration
});
```

## Examples

See the `typescript/examples/iqai-adk-cdp-chatbot` directory for a complete example of a multi-network chatbot with state management and network switching capabilities.

## Features

- **Tool Conversion**: Automatically converts AgentKit actions to ADK-TS tools
- **Type Safety**: Full TypeScript support with type inference
- **Flexible**: Works with any ADK-TS agent type (LLM, Sequential, Parallel, Loop, LangGraph)
- **Multi-Network**: Easy to create agents for different blockchain networks
- **Stateful**: Leverage ADK-TS's state management for complex workflows

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.

## Resources

- [ADK-TS Documentation](https://adk.iqai.com/)
- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [Example: Multi-Network Chatbot](../../examples/iqai-adk-cdp-chatbot/)
