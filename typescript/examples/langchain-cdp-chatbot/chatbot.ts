import {
  AgentKit,
  CdpWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  placeholderActionProvider,
} from "@coinbase/agentkit";
import { PlaceholderActionProvider, PlaceholderActionProviderInterface } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import { ethers, formatUnits, JsonRpcProvider } from "ethers";
import * as fs from "fs";
import * as readline from "readline";

dotenv.config();

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional NETWORK_ID
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

// Add this right after imports and before any other code
validateEnvironment();

// Configure a file to persist the agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Initialize the agent with CDP Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    let walletDataStr: string | null = null;

    // Read existing wallet data if available
    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
      }
    }

    // Configure CDP Wallet Provider
    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

    // Create placeholder provider instance
    const placeholder = placeholderActionProvider() as PlaceholderActionProvider &
      PlaceholderActionProviderInterface;

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        placeholder,
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      ],
    });

    // Initialize placeholder monitoring
    await placeholder.startMonitoring(walletProvider);
    const httpProvider = new JsonRpcProvider(process.env.HTTP_RPC_URL);
    const minimalAbi = [
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
        ],
        name: "getOwnedTokens",
        outputs: [
          {
            internalType: "uint256[]",
            name: "",
            type: "uint256[]",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];
    const placeholderNFT = new ethers.Contract(
      process.env.PLACEHOLDER_NFT_CONTRACT_ADDRESS!,
      minimalAbi,
      httpProvider,
    );
    const tokenIds = await placeholderNFT.getOwnedTokens(process.env.WALLET_ADDRESS!);

    const lastTokenId = tokenIds.length - 1;

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = {
      configurable: {
        thread_id: "CDP AgentKit Placeholder Auction Bot",
        placeholder_provider: placeholder,
      },
    };

    // Create React Agent with auction-specific instructions
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
    You are an autonomous agent managing bids in a Placeholder Ads auction system using USD. Your primary goals are:
    1. Monitor auction events and respond to them
    2. Place bids using different strategies depending on market conditions
    3. Track successful display acquisitions (target: 5 displays)
    4. Adapt bidding strategy based on outcomes

    You have access to the following key functions:
    - place_bid: Place a bid in USD for a specific token ID ${lastTokenId}
    - Always use the same token ID ${lastTokenId}
    - Monitor auction events through the placeholder provider
  
    
    Important: All bids must be in in USD For example:
    - To bid 100 USD, use "100"
    Bidding Strategy Guidelines:
        - Start with conservative bids around $50-100 USD
        - If a bid fails, try increasing by 10-20%
        - Track successful bid amounts to inform future bids
        - Consider auction start and end prices when bidding
    
    You should:
    - Actively participate in auctions when they start
    - Adjust your bidding strategy based on success/failure
    - Track your progress towards the 5 display goal
    - Provide clear updates on your actions and reasoning

    If you encounter any errors or limitations, explain them clearly and try to adapt your strategy.
`,
    });

    // Save wallet data
    const exportedWallet = await walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { agent, config: agentConfig, placeholder };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Run the agent autonomously with specified intervals
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutonomousMode(agent: any, config: any, interval = 10) {
  console.log("Starting autonomous auction bidding mode...");

  let displayCount = 0;
  const maxDisplays = 5;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  let auctionState = await config.configurable.placeholder_provider.auctionState.isActive;
  let currentPrice = await config.configurable.placeholder_provider.fetchCurrentPrice();
  let currentPriceInStableCoin = formatUnits(currentPrice, 18);
  let thought = `
        Monitor auction activity and execute bidding strategy.
        Current displays acquired: ${displayCount}/${maxDisplays}.
        Auction active: ${auctionState.isActive}
        Current price: ${currentPriceInStableCoin} USD)
        Last strategy used: ${config.configurable.placeholder_provider.currentStrategy?.name || "none"}
        Evaluate market conditions and adjust strategy as needed.
      `;
  while (displayCount < maxDisplays) {
    try {
      // Get current auction state
      auctionState = config.configurable.placeholder_provider.auctionState.isActive;
      currentPrice = await config.configurable.placeholder_provider.fetchCurrentPrice();
      currentPriceInStableCoin = formatUnits(currentPrice, 18);
      thought = `
        Monitor auction activity and execute bidding strategy.
        Current displays acquired: ${displayCount}/${maxDisplays}.
        Auction active: ${auctionState.isActive}
        Current price: ${currentPriceInStableCoin} USD)
        Last strategy used: ${config.configurable.placeholder_provider.currentStrategy?.name || "none"}
        Evaluate market conditions and adjust strategy as needed.
      `;

      const auctionActive = config.configurable.placeholder_provider.auctionState.isActive;

      const strategyName = config.configurable.placeholder_provider.currentStrategy?.name || "none";

      console.log(
        `Auction Active: ${auctionActive}, Current Price: ${currentPriceInStableCoin}, Strategy: ${strategyName}`,
      );

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          // console.log("Agent", chunk.agent);
          console.log("Agent Thought:", chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          // console.log("Tools", chunk.tools);
          console.log("Action Taken:", chunk.tools.messages[0].content);

          if (chunk.tools.messages[0].content.includes("Auction won")) {
            // Reset error counter on successful bid
            consecutiveErrors = 0;
            // Update display count from provider state
            displayCount =
              await config.configurable.placeholder_provider.auctionState.currentDisplay;
            // Update auction state from provider
            auctionState = await config.configurable.placeholder_provider.auctionState.isActive;

            console.log(`Updated display count: ${displayCount}/${maxDisplays}`);
            console.log("Updated auction state:", auctionState);
            thought = `
        I won the auction. Must wait for new auction to start.
        One more display count is acquired.
        Current displays acquired: ${displayCount}
        Last strategy used: ${config.configurable.placeholder_provider.currentStrategy?.name || "none"}
        Evaluate market conditions and adjust strategy as needed.
      `;
          }
        }
        console.log("-------------------");
      }

      // Add a dynamic delay based on auction state
      const delayTime = auctionState.isActive ? interval * 1000 : interval * 3000;
      await new Promise(resolve => setTimeout(resolve, delayTime));
    } catch (error) {
      consecutiveErrors++;
      console.error("Error in autonomous mode:", error instanceof Error ? error.message : error);

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`Stopping due to ${maxConsecutiveErrors} consecutive errors`);
        throw new Error(`Autonomous mode stopped: Too many consecutive errors`);
      }

      // Exponential backoff on errors
      const backoffDelay = interval * 2000 * Math.min(consecutiveErrors, 5);
      console.log(`Waiting ${backoffDelay / 1000} seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  console.log("\nTarget number of displays achieved. Autonomous mode completed.");
  console.log("Final Statistics:");
  console.log("- Total displays acquired:", displayCount);
  console.log(
    "- Final strategy used:",
    config.configurable.placeholder_provider.currentStrategy?.name,
  );
}

/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Choose whether to run in autonomous or chat mode based on user input
 *
 * @returns Selected mode
 */
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

/**
 * Start the chatbot agent
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, config);
    } else {
      await runAutonomousMode(agent, config);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
