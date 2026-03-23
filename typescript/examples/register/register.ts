import { CdpEvmWalletProvider } from "@coinbase/agentkit";
import { encodeFunctionData, decodeEventLog } from "viem";
import * as dotenv from "dotenv";

dotenv.config();

// Number of agents to register
const N = 10;

// Identity Registry ABI (only the parts we need)
const IDENTITY_REGISTRY_ABI = [
  {
    inputs: [],
    name: "register",
    outputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "agentId", type: "uint256" },
      { indexed: false, internalType: "string", name: "agentURI", type: "string" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
    ],
    name: "Registered",
    type: "event",
  },
] as const;

// Registry address (deterministic CREATE2 address for all supported networks)
const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

/**
 * Registers a single agent and returns its agentId
 */
async function registerAgent(walletProvider: CdpEvmWalletProvider): Promise<string | undefined> {
  const hash = await walletProvider.sendTransaction({
    to: IDENTITY_REGISTRY_ADDRESS,
    data: encodeFunctionData({
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [],
    }),
  });
  console.log("Transaction hash:", hash);

  // const receipt = await walletProvider.waitForTransactionReceipt(hash);

  // // Parse the Registered event to get the agentId
  // for (const log of receipt.logs) {
  //   try {
  //     const decoded = decodeEventLog({
  //       abi: IDENTITY_REGISTRY_ABI,
  //       data: log.data,
  //       topics: log.topics,
  //     });
  //     if (decoded.eventName === "Registered") {
  //       return (decoded.args as unknown as { agentId: bigint }).agentId.toString();
  //     }
  //   } catch {
  //     // Not the event we're looking for
  //   }
  // }

  return undefined;
}

/**
 * Main function to register N agents
 */
async function main() {
  validateEnvironment();

  console.log(`Registering ${N} agents on ERC-8004 Identity Registry...\n`);

  // Configure CDP Wallet Provider
  const networkId = process.env.NETWORK_ID || "base-sepolia";
  const cdpWalletConfig = {
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    idempotencyKey: process.env.IDEMPOTENCY_KEY,
    address: process.env.ADDRESS as `0x${string}` | undefined,
    networkId,
    rpcUrl: process.env.RPC_URL,
  };

  const walletProvider = await CdpEvmWalletProvider.configureWithWallet(cdpWalletConfig);
  const walletAddress = walletProvider.getAddress();

  console.log(`Wallet address: ${walletAddress}`);
  console.log(`Network: ${networkId}`);
  console.log(`Registry: ${IDENTITY_REGISTRY_ADDRESS}\n`);

  const registeredAgentIds: string[] = [];

  for (let i = 0; i < N; i++) {
    console.log(`Registering agent ${i + 1}/${N}...`);

    try {
      const agentId = await registerAgent(walletProvider);
      if (agentId) {
        registeredAgentIds.push(agentId);
        console.log(`  ✓ Agent ID: ${agentId}`);
      } else {
        console.log(`  ✓ Registered (could not parse agentId from event)`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to register agent ${i + 1}:`, error);
    }
  }

  console.log("\n========================================");
  console.log(`Registration complete!`);
  console.log(`Successfully registered: ${registeredAgentIds.length}/${N} agents`);
  if (registeredAgentIds.length > 0) {
    console.log(`Agent IDs: ${registeredAgentIds.join(", ")}`);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
