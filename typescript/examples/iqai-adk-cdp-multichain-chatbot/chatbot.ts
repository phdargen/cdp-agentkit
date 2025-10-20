import {
  AgentKit,
  CdpEvmWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  erc721ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  x402ActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getAdkTools } from "@coinbase/agentkit-iqai-adk";
import { AgentBuilder, LlmAgent, createTool, type BaseTool, type EnhancedRunner } from "@iqai/adk";
import * as dotenv from "dotenv";
import * as readline from "readline";
import { z } from "zod";

dotenv.config();

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

interface NetworkConfig {
  id: string;
  name: string;
  isDefault: boolean;
}

// Parse NETWORK_IDS from environment or use defaults
const getNetworkIds = (): string[] => {
  const envNetworks = process.env.NETWORK_IDS;
  if (envNetworks) {
    return envNetworks.split(',').map(n => n.trim()).filter(n => n.length > 0);
  }
  return ["base-sepolia", "ethereum-sepolia"];
};

const networkIds = getNetworkIds();
const SUPPORTED_NETWORKS: NetworkConfig[] = networkIds.map((id, index) => ({
  id,
  name: id,
  isDefault: index === 0, // First network in array is default
}));

const DEFAULT_NETWORK = SUPPORTED_NETWORKS[0].id;

// ============================================================================
// VALIDATION
// ============================================================================

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
}

validateEnvironment();

// ============================================================================
// CHAIN STATE MANAGEMENT
// ============================================================================

// Use a closure to maintain state across tool calls
let currentChain = DEFAULT_NETWORK;

function getCurrentChainId(): string {
  return currentChain;
}

function setCurrentChainId(chainId: string): void {
  currentChain = chainId;
}

// ============================================================================
// CHAIN SWITCHING TOOLS (Generic)
// ============================================================================

function createChainSwitchingTools() {
  const tools: BaseTool[] = [];

  // Single switch tool with network parameter using Zod schema
  // Create dynamic enum from supported networks
  const networkIds = SUPPORTED_NETWORKS.map(n => n.id);
  const networkSchema = z.object({
    network: z.enum(networkIds as [string, ...string[]]).describe(`The network ID to switch to. Supported: ${networkIds.join(", ")}`),
  });

  const switchNetworkTool = createTool({
    name: "switch_network",
    description: `Switch to a different blockchain network. Supported networks: ${networkIds.join(", ")}`,
    schema: networkSchema as any, // Type assertion to work around Zod version incompatibility
    fn: async (args: any) => {
      try {
        console.log("[DEBUG] switch_network called with args:", JSON.stringify(args));
        
        // Validate and extract network parameter
        const network = args?.network;
        
        if (!network || typeof network !== 'string') {
          const msg = `Missing or invalid 'network' parameter. Expected one of: ${networkIds.join(", ")}. Received: ${JSON.stringify(args)}`;
          console.log("[DEBUG]", msg);
          return msg;
        }
        
        const targetNetwork = SUPPORTED_NETWORKS.find(n => n.id === network);
        if (!targetNetwork) {
          const msg = `Unknown network '${network}'. Supported networks are: ${SUPPORTED_NETWORKS.map(n => n.id).join(", ")}`;
          console.log("[DEBUG]", msg);
          return msg;
        }
        
        setCurrentChainId(network);
        const successMsg = `Successfully switched to ${targetNetwork.name} (${network})`;
        console.log("[DEBUG]", successMsg);
        return successMsg;
      } catch (error) {
        const errorMsg = `Exception in switch_network: ${error instanceof Error ? error.message : String(error)}`;
        console.error("[DEBUG]", errorMsg);
        return errorMsg;
      }
    },
  } as any);

  tools.push(switchNetworkTool);

  // Add current chain query tool
  const getCurrentChain = createTool({
    name: "get_current_chain",
    description: "Get the currently active blockchain network",
    fn: async () => {
      const chainId = getCurrentChainId();
      const network = SUPPORTED_NETWORKS.find(n => n.id === chainId);
      return `Currently on ${network?.name || chainId} (${chainId})`;
    },
  });

  tools.push(getCurrentChain);

  // Add list networks tool
  const listNetworks = createTool({
    name: "list_supported_networks",
    description: "List all supported blockchain networks",
    fn: async () => {
      const networkList = SUPPORTED_NETWORKS.map(
        n => `  - ${n.name} (${n.id})${n.isDefault ? " [default]" : ""}`
      ).join("\n");
      return `Supported networks:\n${networkList}`;
    },
  });

  tools.push(listNetworks);

  return tools;
}

// ============================================================================
// NETWORK AGENTS (Generic)
// ============================================================================

async function createNetworkAgent(networkId: string): Promise<LlmAgent> {
  const network = SUPPORTED_NETWORKS.find(n => n.id === networkId);
  if (!network) {
    throw new Error(`Unsupported network: ${networkId}`);
  }

  const cdpWalletConfig = {
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
    networkId,
    rpcUrl: process.env[`RPC_URL_${networkId.toUpperCase().replace(/-/g, "_")}`],
  };

  const walletProvider = await CdpEvmWalletProvider.configureWithWallet(cdpWalletConfig);

  const actionProviders = [
    walletActionProvider(),
    cdpApiActionProvider(),
    cdpEvmWalletActionProvider(),
    wethActionProvider(),
    erc20ActionProvider(),
    x402ActionProvider(),
    pythActionProvider(),
  ];

  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders,
  });

  const tools = await getAdkTools(agentkit);

  // Customize faucet instruction based on network
  const faucetInstruction = networkId.includes("sepolia")
    ? `If you ever need funds, you can request them from the faucet since you are on ${network.name} testnet.`
    : `If you need funds, provide your wallet details and request them from the user.`;

  return new LlmAgent({
    name: `${networkId.replace(/-/g, "_")}_agent`,
    model: process.env.LLM_MODEL || "gpt-4o",
    description: `Blockchain operations agent for ${network.name} (${networkId})`,
    instruction: `
      You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit on the ${network.name} network.
      You are empowered to interact onchain using your tools. ${faucetInstruction} If not, you can provide your wallet 
      details and request funds from the user. Before executing your first action, get the wallet details to see what 
      network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
      asks you to do something you can't do with your currently available tools, you must say so, and encourage them 
      to implement it themselves using the CDP SDK + Agentkit, recommend they go to docs.cdp.coinbase.com for more 
      information. Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless 
      it is explicitly requested.
      
      IMPORTANT: You can only operate on ${network.name} (${networkId}). If the user requests operations on a different 
      network, inform them they need to switch networks first.
    `,
    tools,
  });
}

// ============================================================================
// MULTI-CHAIN COORDINATOR
// ============================================================================

async function createMultiChainCoordinator(): Promise<EnhancedRunner> {
  console.log("Initializing network agents...");
  
  // Create all network agents as LlmAgents
  const networkAgents: LlmAgent[] = [];
  for (const network of SUPPORTED_NETWORKS) {
    console.log(`  Loading ${network.name}...`);
    const agent = await createNetworkAgent(network.id);
    networkAgents.push(agent);
  }

  const chainTools = createChainSwitchingTools();

  // Build network descriptions for instructions
  const networkDescriptions = SUPPORTED_NETWORKS.map(
    n => `  - ${n.name} (${n.id}): ${n.id.replace(/-/g, "_")}_agent`
  ).join("\n");

  const { runner } = await AgentBuilder.create("multi_chain_coordinator")
    .withModel(process.env.LLM_MODEL || "gpt-4o")
    .withDescription("Multi-chain blockchain coordinator with persistent network state")
    .withInstruction(`
      You are a multi-chain blockchain coordinator that manages network state and delegates operations to specialized agents.
      
      NETWORK STATE MANAGEMENT:
      - The system maintains the current active network
      - Default network is ${DEFAULT_NETWORK}
      - Use get_current_chain tool to check which network is currently active
      - Always be aware of which network is currently active before delegating operations
      
      SUPPORTED NETWORKS:
${networkDescriptions}
      
      CHAIN SWITCHING:
      When the user wants to switch networks, you MUST call the switch_network tool with proper parameters.
      
      EXAMPLES:
${SUPPORTED_NETWORKS.slice(0, 2).map(n => 
  `        User says: "switch to ${n.name.toLowerCase()}" or "use ${n.id}"\n        → Call: switch_network with args {"network": "${n.id}"}`
).join("\n        \n")}
      
      CRITICAL: The switch_network tool requires a "network" parameter. You MUST pass it like: {"network": "${SUPPORTED_NETWORKS[0].id}"}
      DO NOT call switch_network without the network parameter or with an empty object {}.
      
      After switching:
        - Confirm the network switch to the user with a clear message
        - DO NOT delegate blockchain operations during a switch command - just switch and confirm
      
      Available network management tools:
        - switch_network(network: string): Switch to a different network - MUST pass {"network": "network-id"}
        - get_current_chain(): Check which network is currently active - no parameters needed
        - list_supported_networks(): Show all available networks - no parameters needed
      
      BLOCKCHAIN OPERATIONS:
      When the user wants to perform blockchain operations (transfers, balance checks, wallet info, etc.):
        1. First, use get_current_chain to verify which network is currently active
        2. Delegate to the corresponding network-specific agent:
${SUPPORTED_NETWORKS.map(n => `           - ${n.id} → ${n.id.replace(/-/g, "_")}_agent`).join("\n")}
        3. The network agent will execute the operation using its blockchain tools
      
      IMPORTANT RULES:
      - Always confirm network switches explicitly with clear feedback
      - Each network agent can ONLY operate on its designated network
      - If unsure which network to use, use get_current_chain to check
      - Network agents handle all blockchain operations, you handle routing and network state
      - When delegating, make sure to use the agent that matches the current active network
    `)
    .withTools(...chainTools)
    .withSubAgents(networkAgents)
    .build();

  return runner;
}

// ============================================================================
// CHAT INTERFACE
// ============================================================================

async function runChatMode(coordinator: EnhancedRunner): Promise<void> {
  console.log("🤖 Multi-Chain Chatbot Ready!");
  console.log("\n💡 Available commands:");
  const networkExamples = SUPPORTED_NETWORKS.slice(0, 2).map(n => `"switch to ${n.id}"`).join(" or ");
  console.log(`   - Switch networks: ${networkExamples}`);
  console.log(`   - Check current: "which network am I on?" or "get current chain"`);
  console.log(`   - List networks: "what networks are supported?"`);
  console.log(`   - Operations: "check my balance", "send 0.01 ETH to 0x...", "wallet info"`);
  console.log(`   - Exit: "exit"\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    console.log(`📍 Starting on ${SUPPORTED_NETWORKS.find(n => n.id === DEFAULT_NETWORK)?.name}\n`);

    while (true) {
      const userInput = await question("💬 Prompt: ");

      if (userInput.toLowerCase().trim() === "exit") {
        console.log("\n👋 Goodbye!");
        break;
      }

      if (!userInput.trim()) {
        continue;
      }

      try {
        const result = await coordinator.ask(userInput);
        console.log(`\n${result}`);
        console.log("-------------------\n");
      } catch (error) {
        console.error("\n❌ Error:", error instanceof Error ? error.message : error);
        console.log("-------------------\n");
      }
    }
  } finally {
    rl.close();
  }
}

// ============================================================================
// AUTONOMOUS MODE (Optional)
// ============================================================================

async function runAutonomousMode(coordinator: EnhancedRunner, interval = 10): Promise<void> {
  console.log("🤖 Starting autonomous mode...\n");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities. " +
        "You can switch between networks and perform operations on different chains.";

      const result = await coordinator.ask(thought);
      console.log(`${result}`);
      console.log("-------------------\n");

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

// ============================================================================
// MODE SELECTION
// ============================================================================

async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const choice = (await question("\nChoose a mode (enter number or name): "))
      .toLowerCase()
      .trim();

    if (choice === "1" || choice === "chat") {
      rl.close();
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      rl.close();
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  try {
    const coordinator = await createMultiChainCoordinator();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(coordinator);
    } else {
      await runAutonomousMode(coordinator);
    }
  } catch (error) {
    console.error("Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("🚀 Starting Multi-Chain Agent...\n");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

