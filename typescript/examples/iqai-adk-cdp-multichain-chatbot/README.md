# Multi-Chain CDP Agentkit Chatbot with IQAI ADK

An intelligent multi-chain blockchain chatbot that can switch between networks and execute operations using the Coinbase Developer Platform (CDP) AgentKit and IQAI ADK framework.

## Features

- 🔗 **Multi-Chain Support**: Switch between Base Sepolia and Ethereum Sepolia
- 🤖 **Intelligent Delegation**: LLM-powered routing to network-specific agents
- 💾 **Persistent State**: Network selection persists across interactions
- 🛠️ **Full CDP Integration**: Access to all CDP AgentKit blockchain operations
- 🔄 **Dynamic Network Switching**: Change networks on the fly with simple commands

## Supported Networks

- **Base Sepolia** (default) - Base testnet
- **Ethereum Sepolia** - Ethereum testnet

## Prerequisites

- Node.js 18+
- CDP API credentials
- LLM API access (Gemini, OpenAI, etc.)

## Installation

1. Navigate to the example directory:
   ```bash
   cd typescript/examples/iqai-adk-cdp-multichain-chatbot
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

## Usage

Start the chatbot:
```bash
pnpm start
```

### Example Commands

**Network Management:**
- "switch to ethereum sepolia"
- "switch to base sepolia"
- "which network am I on?"
- "what networks are supported?"

**Blockchain Operations:**
- "check my balance"
- "send 0.01 ETH to 0x..."
- "deploy an ERC-20 token"
- "request funds from faucet"

## Architecture

The chatbot uses IQAI ADK's LLM delegation pattern:

1. **Coordinator Agent**: Routes requests and manages network state
2. **Network Agents**: Specialized agents for each blockchain (Base, Ethereum)
3. **Chain Tools**: Tools for switching networks and querying state
4. **Persistent Session**: Maintains current network across interactions

## Adding New Networks

To add support for additional networks:

1. Add network to `SUPPORTED_NETWORKS` array:
   ```typescript
   { id: "polygon-amoy", name: "Polygon Amoy", isDefault: false }
   ```

2. The network agent and switching tools are generated automatically!

## How It Works

The coordinator maintains a persistent session with `current_chain` state. When you request a network switch, it calls a chain-switching tool that updates the session state. For blockchain operations, the coordinator delegates to the appropriate network-specific agent based on the current state.

## License

Apache-2.0

