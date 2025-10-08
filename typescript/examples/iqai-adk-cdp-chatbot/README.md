# CDP Chatbot with IQAI ADK

This example demonstrates a blockchain chatbot built with CDP AgentKit and IQAI ADK (Agent Development Kit for TypeScript).

## Features

🛠️ **Full AgentKit Capabilities**
- Wallet operations (balance, address, transfers)
- ERC-20 token interactions
- ERC-721 NFT operations
- WETH wrapping/unwrapping
- CDP API integration
- X402 payment support

🤖 **IQAI ADK Integration**
- Uses IQAI ADK's LlmAgent for intelligent tool selection
- Powered by Gemini 2.0 Flash
- LLM automatically determines which blockchain actions to execute
- Natural conversation flow

🎯 **Two Operation Modes**
- **Chat Mode**: Interactive conversations with the agent
- **Autonomous Mode**: Agent executes interesting blockchain actions on its own

## How It Works

The chatbot:

1. **Initialization**: Creates an AgentKit instance with:
   - EVM wallet provider for the specified network
   - AgentKit instance with blockchain actions
   - IQAI ADK LlmAgent with Gemini model

2. **Mode Selection**: Choose between:
   - Chat mode for interactive conversations
   - Autonomous mode for creative blockchain actions

3. **Tool Execution**: The LLM agent automatically selects and executes appropriate blockchain tools based on user requests.

## Prerequisites

### Node Version

Before using the example, ensure you have Node.js 20 or higher:

```bash
node --version
```

If you need to install or upgrade Node.js, use [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install node
```

### API Keys

You'll need:
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [CDP Wallet Secret](https://portal.cdp.coinbase.com/products/wallet-api)
- [Google AI API Key](https://aistudio.google.com/app/apikey) (for Gemini model)

## Setup

1. **Install dependencies** (from the repository root):

```bash
pnpm install
pnpm build
```

2. **Configure environment variables**:

Create a `.env` file in the example directory with the following:
```bash
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
CDP_API_KEY_ID=your_cdp_api_key_id_here
CDP_API_KEY_SECRET=your_cdp_api_key_secret_here
CDP_WALLET_SECRET=your_cdp_wallet_secret_here
NETWORK_ID=base-sepolia  # Optional, defaults to base-sepolia
```

## Running the Chatbot

From the `typescript/examples/iqai-adk-cdp-chatbot` directory:

```bash
pnpm start
```

You'll be prompted to choose a mode:
1. **chat** - Interactive chat mode
2. **auto** - Autonomous action mode

## Example Interactions

### Chat Mode

```bash
Starting Agent...

Available modes:
1. chat    - Interactive chat mode
2. auto    - Autonomous action mode

Choose a mode (enter number or name): 1
Starting chat mode... Type 'exit' to end.

Prompt: What's my balance?
Your balance on base-sepolia is 0.5 ETH
-------------------

Prompt: Deploy an NFT called "Cool Cats"
Successfully deployed NFT contract at 0xabcd...
-------------------

Prompt: exit
```

### Autonomous Mode

In autonomous mode, the agent will autonomously execute interesting blockchain actions every 10 seconds:

```bash
Choose a mode (enter number or name): 2
Starting autonomous mode...
I'll check my wallet balance and explore some interesting NFT deployments...
-------------------
```

## Key Files

- `chatbot.ts` - Main chatbot implementation
- `package.json` - Dependencies and scripts
- `README.md` - This file

## Extending the Example

### Using a Different Network

Set the `NETWORK_ID` environment variable:

```bash
NETWORK_ID=ethereum-mainnet  # or base-mainnet, ethereum-sepolia, etc.
```

### Using a Different LLM Model

Modify the `model` parameter in `initializeAgent()`:

```typescript
const agent = new LlmAgent({
  name: "CDP AgentKit Chatbot",
  model: "gemini-1.5-pro",  // or other supported models
  tools,
  instruction: `...`,
});
```

Check [IQAI ADK documentation](https://adk.iqai.com/) for supported models.

### Adding Custom Action Providers

Add your own blockchain actions:

```typescript
const actionProviders = [
  walletActionProvider(),
  cdpApiActionProvider(),
  cdpEvmWalletActionProvider(),
  // ... existing providers
  myCustomActionProvider(), // Add your custom provider
];
```

## Resources

- [ADK-TS Documentation](https://adk.iqai.com/)
- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [CDP Platform](https://portal.cdp.coinbase.com/)
- [Framework Extension Code](../../framework-extensions/iqai-adk/)

## Troubleshooting

**Error: Required environment variables are not set**
- Make sure you've created a `.env` file with all required variables
- Check that the values are valid CDP API credentials and Google AI API key

**Error: Failed to initialize agent**
- Verify your wallet secret is correct
- Check your CDP account has access to the specified network
- Ensure your Google AI API key is valid

**Model or API errors**
- Check your Google AI API key permissions
- Verify you have access to the Gemini models
- Try a different model if the current one is unavailable

## License

Apache-2.0
