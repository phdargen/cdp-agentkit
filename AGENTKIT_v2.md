# Agentkit v2

Outlines plans for significant Agentkit upgrade to make it more modular, define clear wallet/action provider capabilities/requirements and support external wallet signing. 

1. [Capability-Based Wallet/Action Provider Matching](#1-capability-based-walletaction-provider-matching)
2. [External Wallet Support](#2-external-wallet-support)
3. [Modular Package Structure](#3-modular-package-structure)
4. [New examples](#4-new-examples)
5. [Deprecations & Dependency Updates](#5-deprecations--dependency-updates)

---

## 1. Capability-Based Wallet/Action Provider Matching

### Problem

The current `supportsNetwork(network: Network)` filtering is insufficient:
- Actions fail at runtime when wallet lacks required capabilities (e.g., `signTypedData`)
- No formal mechanism for tightly coupled providers (e.g., `ZeroDevWalletActionProvider` → `ZeroDevWalletProvider`)
- Manual capability checking via wallet name strings

### Solution

Introduce capability-based matching:
1. **WalletProviders** declare capabilities via `getCapabilities()`
2. **ActionProviders** declare requirements (provider-wide + per-action via `@CreateAction`)
3. **`AgentKit.from()`** performs automatic capability matching
4. **WalletProviders** can declare bundled ActionProviders

### Interfaces

```typescript
export interface WalletCapabilities {
  protocolFamily: 'evm' | 'svm';
  supportedNetworks: string[];  // Empty = all networks of protocol
  transactionMethod: 'standard' | 'user-operation';
  messageSigning: boolean;
  typedDataSigning: boolean;
  features: Record<string, boolean>;  // spendPermissions, etc.
  signingMode: 'server' | 'external';  // See Section 2
}

export interface ActionRequirements {
  protocolFamilies: ('evm' | 'svm')[];  // Empty = all
  supportedNetworks: string[];  // Empty = all
  transactionMethods: ('standard' | 'user-operation')[];  // Empty = all
  messageSigning: boolean;
  typedDataSigning: boolean;
  walletProviderType: string | null;  // For tightly coupled actions
  features: string[];
  apiKeys: string[];
}
```

### Examples

**WalletProvider declaring capabilities:**

```typescript
// CdpSmartWalletProvider
getCapabilities(): WalletCapabilities {
  return {
    protocolFamily: 'evm',
    supportedNetworks: ['base-mainnet', 'base-sepolia', 'ethereum-mainnet'],
    transactionMethod: 'user-operation',
    messageSigning: true,
    typedDataSigning: true,
    features: { spendPermissions: true },
  };
}

getBundledActionProviders(): ActionProvider[] {
  return [cdpSmartWalletActionProvider()];
}
```

**ActionProvider declaring requirements:**

```typescript
// ZoraActionProvider
getDefaultRequirements(): ActionRequirements {
  return {
    protocolFamilies: ['evm'],
    supportedNetworks: ['base-mainnet', 'base-sepolia'],
    transactionMethods: ['standard', 'user-operation'],
    messageSigning: false,
    typedDataSigning: false,
    walletProviderType: null,
    features: [],
    apiKeys: ['PINATA_JWT'],
  };
}
```

**Per-action requirement overrides via `@CreateAction`:**

Individual actions can override provider defaults by specifying a `requirements` property. Overrides are merged with defaults (action-level takes precedence).

```typescript
@CreateAction({
  name: "listCoinWithSignature",
  description: "Lists a coin using EIP-712 signature",
  schema: ListCoinSchema,
  requirements: { typedDataSigning: true },  // Override: this action needs typed data
})
async listCoinWithSignature(wallet: EvmWalletProvider, args: z.infer<typeof ListCoinSchema>) {
  // ...
}
```

### Matching Logic

`AgentKit.from()` replaces `supportsNetwork()` with capability-based matching. For each action provider, it checks if the wallet's capabilities satisfy the action's requirements:

```typescript
// AgentKit.from() - simplified matching logic
function isCompatible(wallet: WalletCapabilities, action: ActionRequirements): boolean {
  // Protocol must match (empty = accepts all)
  if (action.protocolFamilies.length && !action.protocolFamilies.includes(wallet.protocolFamily))
    return false;
  
  // Network must be supported (empty = accepts all)
  if (action.supportedNetworks.length && !action.supportedNetworks.includes(currentNetwork))
    return false;
  
  // Transaction method must be compatible
  if (action.transactionMethods.length && !action.transactionMethods.includes(wallet.transactionMethod))
    return false;
  
  // Required signing capabilities
  if (action.messageSigning && !wallet.messageSigning) return false;
  if (action.typedDataSigning && !wallet.typedDataSigning) return false;
  
  // Required features (e.g., spendPermissions)
  if (action.features.some(f => !wallet.features[f])) return false;
  
  return true;
}

// Bundled providers are auto-included from the wallet
const bundledProviders = walletProvider.getBundledActionProviders?.() ?? [];
const allProviders = [...userProviders, ...bundledProviders];
const compatibleProviders = allProviders.filter(p => isCompatible(walletCaps, p.getDefaultRequirements()));
```

This enables compile-time type safety for tightly-coupled providers (e.g., `CdpSmartWalletActionProvider<CdpSmartWalletProvider>`) while allowing generic providers to work across compatible wallets.

---

## 2. External Wallet Support

### Problem

- No support for user-controlled wallets (e.g., MetaMask, Coinbase Wallet via wagmi/XMTP)
- String-based tool outputs are hard to parse programmatically and prone to missing details
- LLMs hallucinate block explorer links (e.g., etherscan when on Base)
- Transaction status not tracked—agent reports "submitted" but tx may revert

### Solution

Enable action providers to work with both server-side and external signing:
1. **`signingMode` capability** in `WalletCapabilities` (Section 1): `'server'` (has private key) or `'external'` (prepares tx for user signing)
2. **Add `sendTransactions()` method** to WalletProvider for atomic batch execution
3. **Structured tool responses** via discriminated union types
4. **`executeOrPrepare()` helper** that branches based on wallet capability

### New WalletProvider Method

```typescript
interface WalletProvider {
  /**
   * Execute multiple transactions atomically.
   * - Smart wallets batch into single user-operation
   * - EOA wallets execute sequentially
   * @throws For external signing mode wallets
   */
  sendTransactions(calls: TransactionCall[]): Promise<`0x${string}`[]>;
}
```

### Structured Tool Response Types

```typescript
interface TransactionCall {
  name: string;              // "approve", "transfer", "swap"
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
}

interface ExecutedTransaction {
  name: string;
  txHash: `0x${string}`;
  txLink: string;            // Full block explorer URL
  status: 'success' | 'reverted';
}

// Discriminated union for type-safe parsing
type ToolResponse =
  | { type: 'data'; success: boolean; message: string; data: Record<string, unknown> }
  | { type: 'executed'; success: boolean; message: string; transactions: ExecutedTransaction[] }
  | { type: 'prepared'; success: true; message: string; calls: TransactionCall[]; metadata?: Record<string, unknown> }
  | { type: 'error'; success: false; message: string; code?: string };
```

**Response semantics:**
- `success` reflects overall outcome—`false` if any transaction reverts
- Each transaction in `transactions[]` has individual `status` for granular reporting

### Core Helper

```typescript
async function executeOrPrepare(
  walletProvider: WalletProvider,
  calls: TransactionCall[],
  options?: { message?: string; metadata?: Record<string, unknown> }
): Promise<ToolResponse> {
  const { signingMode } = walletProvider.getCapabilities();

  if (signingMode === 'external') {
    return { type: 'prepared', success: true, message: options?.message, calls, metadata: options?.metadata };
  }

  const hashes = await walletProvider.sendTransactions(calls);
  const transactions = await Promise.all(hashes.map(async (hash, i) => {
    const receipt = await walletProvider.waitForTransactionReceipt(hash);
    return {
      name: calls[i].name,
      txHash: hash,
      txLink: getBlockExplorerTxUrl(walletProvider.getNetwork().networkId, hash),
      status: receipt.status === 'success' ? 'success' : 'reverted',
    };
  }));

  return {
    type: 'executed',
    success: transactions.every(t => t.status === 'success'),
    message: options?.message,
    transactions,
  };
}
```

### Unified Action Provider Pattern

```typescript
@CreateAction({ name: "transfer", schema: TransferSchema, ... })
async transfer(wallet: EvmWalletProvider, args): Promise<string> {
  // 1. Validation & guardrails (identical for both modes)
  const tokenDetails = await getTokenDetails(wallet, args.tokenAddress);
  if (!tokenDetails) {
    return JSON.stringify({ type: 'error', success: false, message: 'Token not found', code: 'TOKEN_NOT_FOUND' });
  }

  // 2. Build calls array
  const calls: TransactionCall[] = [{
    name: 'transfer',
    to: args.tokenAddress,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [...] }),
    value: '0',
  }];

  // 3. Execute or prepare based on wallet capability
  const result = await executeOrPrepare(wallet, calls, { message: `Transfer ${args.amount} ${tokenDetails.name}` });
  return JSON.stringify(result);
}
```

### Frontend Integration

When `signingMode: 'external'`, action providers return `type: 'prepared'` with call data. The frontend intercepts this and prompts the user to sign via their connected wallet:

```typescript
// Frontend parses tool output from agent
const result = JSON.parse(toolOutput);

if (result.type === 'prepared') {
  // User signs via their wallet (wagmi, XMTP, etc.)
  // Example with wagmi:
  for (const call of result.calls) {
    const hash = await sendTransactionAsync({  // wagmi hook
      to: call.to,
      data: call.data,
      value: BigInt(call.value),
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
} else if (result.type === 'executed') {
  // Server already signed & executed—just display results
  displayResults(result.transactions);
}
```

---

## 3. Modular Package Structure

### Problem

The current monolithic `@coinbase/agentkit` package bundles all 40+ action providers and all wallet providers, forcing users to install heavy dependencies (Sushi SDK, Jupiter SDK, OpenSea SDK, etc.) even when only using a subset of functionality. 

### Solution

Split into a modular monorepo with protocol-isolated packages. Use **subpath exports** for packages with a shared external SDK (CDP, Privy), and **separate packages** for domains with distinct external dependencies (DeFi protocols).

### Package Structure

**Core packages:**
```
@coinbase/agentkit-core        # Abstract bases, types, decorator, AgentKit class
@coinbase/agentkit-evm         # EvmWalletProvider, ViemWalletProvider, erc20, erc721, weth
@coinbase/agentkit-svm         # SvmWalletProvider, SolanaKeypairWalletProvider, spl
@coinbase/agentkit             # Meta-package re-exporting all (backward compatibility)
```

**Vendor packages (subpath exports - shared SDK):**
```
@coinbase/agentkit-cdp         # /evm, /svm subpaths
@coinbase/agentkit-privy       # /evm, /svm subpaths
```

**Domain packages (separate - distinct SDKs per protocol):**
```
@coinbase/agentkit-defi-evm    # morpho, compound, moonwell, sushi, enso, vaultsfyi
@coinbase/agentkit-defi-svm    # jupiter
@coinbase/agentkit-social      # twitter, farcaster (chain-agnostic, no subpaths)
```

### Subpath Pattern

Vendor packages use subpath exports with optional peer dependencies to avoid pulling in unused protocol code:

```json
// @coinbase/agentkit-cdp/package.json
{
  "exports": {
    "./evm": "./dist/evm/index.js",
    "./svm": "./dist/svm/index.js"
  },
  "peerDependencies": {
    "@coinbase/agentkit-evm": "^1.0.0",
    "@coinbase/agentkit-svm": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "@coinbase/agentkit-evm": { "optional": true },
    "@coinbase/agentkit-svm": { "optional": true }
  }
}
```

Usage:
```typescript
import { CdpSmartWalletProvider } from '@coinbase/agentkit-cdp/evm';
// Only requires agentkit-evm, not agentkit-svm
```

### Third-Party Extensibility

The architecture enables third-party wallet and action providers by depending only on `agentkit-core` and the relevant protocol package:

```typescript
// @thirdweb/agentkit-thirdweb
import { EvmWalletProvider } from '@coinbase/agentkit-evm';
import type { WalletCapabilities } from '@coinbase/agentkit-core';

export class ThirdWebWalletProvider extends EvmWalletProvider {
  getCapabilities(): WalletCapabilities { /* ... */ }
  getBundledActionProviders() { return [ThirdWebActionProvider()]; }
}
```

```typescript
// @aave/agentkit-aave
import { ActionProvider, CreateAction } from '@coinbase/agentkit-core';
import type { EvmWalletProvider } from '@coinbase/agentkit-evm';

export class AaveActionProvider extends ActionProvider<EvmWalletProvider> {
  @CreateAction({ name: 'aave_deposit', ... })
  async deposit(wallet: EvmWalletProvider, args) { /* ... */ }
}
```

---

## 4. New examples

- create-onchain-agent: external wallet wagmi/onchainkit
- create-onchain-agent: external wallet CDP embedded wallet
- langchain-xmtp-external chatbot

---

---

## 5. Deprecations & Dependency Updates

### Deprecations

- Deprecate `cdp-legacy/` wallet provider
- Deprecate `wow/` action provider

### Framework Extensions Updates

- Upgrade to Zod v4
- Upgrade to LangChain v1
- Upgrade to Vercel AI SDK v6

---
