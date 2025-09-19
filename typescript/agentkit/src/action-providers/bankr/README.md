# Bankr Action Provider

This directory contains the **BankrActionProvider** implementation, which provides actions to interact with **Bankr Agent** via their x402 API.

## Directory Structure

```
bankr/
├── bankrActionProvider.ts         # Main provider with Bankr functionality
├── constants.ts                   # Constants for Bankr provider
├── schemas.ts                     # Bankr action schemas
├── types.ts                       # TypeScript interfaces
├── utils.ts                       # Utility functions
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `prompt`: Send a prompt to Bankr Agent with automatic setup

  - Automatically checks BNKR token balance in wallet
  - Checks allowance for Bankr service
  - If allowance is insufficient, automatically approves the required amount
  - Sends the prompt to the Bankr API
  - Polls until job completion or failure
  - Returns the **final job result** with transaction details

- `get_job_status`: Get status of a Bankr job with polling

  - Takes a job ID and polls until completion
  - Returns the **final job status** and results
  - Configurable polling interval, max attempts, and timeout

- `approve_bnkr_spending`: Manually approve BNKR token spending

  - Approves a spender address to transfer BNKR tokens
  - By default approves maximum amount to avoid repeated approvals
  - Returns the **transaction hash** upon success

## Configuration

The provider requires a Bankr API key, which can be provided via:

1. Constructor config: `bankrActionProvider({ apiKey: "your-key" })`
2. Environment variable: `BANKR_API_KEY`

Optional configuration:
- `baseUrl`: Custom Bankr API base URL (defaults to "https://api.bankr.bot")

## Usage Example

```typescript
import { bankrActionProvider } from "@coinbase/agentkit";

// Initialize with API key
const bankr = bankrActionProvider({ 
  apiKey: "your-bankr-api-key" 
});

// Or use environment variable BANKR_API_KEY
const bankr = bankrActionProvider();
```

## Network Support

The Bankr provider supports all EVM-compatible networks where the BNKR token is available.

## BNKR Token

The provider automatically handles the Banker (BNKR) token:
- **Contract Address**: `0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b`
- **Purpose**: Required for payment to Bankr services via x402
- **Auto-approval**: The `prompt` action automatically approves BNKR spending if needed

## Notes

For more information on the **Bankr Agent**, visit [Bankr Documentation](https://www.npmjs.com/package/@bankr/sdk).
