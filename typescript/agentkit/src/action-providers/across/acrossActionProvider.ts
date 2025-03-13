import { z } from "zod";
import { parseUnits, Hex, parseEther } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { BridgeTokenSchema } from "./schemas";
import { SUPPORTED_CHAINS, INTEGRATOR_ID } from "./constants";
import { EvmWalletProvider } from "../../wallet-providers";
import { arbitrum, baseSepolia, optimism } from "viem/chains";
import { sepolia } from "viem/chains";

/**
 * AcrossActionProvider provides actions for cross-chain bridging via Across Protocol.
 */
export class AcrossActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the AcrossActionProvider.
   */
  constructor() {
    super("across", []);
  }
  
  /**
   * Bridges a token from one chain to another using Across Protocol.
   * 
   * @param walletProvider - The wallet provider to use for the transaction.
   * @param args - The input arguments for the action.
   * @returns A message containing the bridge details.
   */
  @CreateAction({
    name: "bridge_token",
    description: `
    This tool will bridge tokens from one chain to another using the Across Protocol.
    
    It takes the following inputs:
    - originChainId: The chain ID of the origin chain
    - destinationChainId: The chain ID of the destination chain
    - inputToken: The address of the token to bridge from the origin chain
    - outputToken: The address of the token to receive on the destination chain
    - amount: The amount of tokens to bridge
    - recipient: (Optional) The recipient address on the destination chain (defaults to sender)
    
    Important notes:
    - Ensure sufficient balance of the input token before bridging
    - The wallet must be connected to the origin chain
    - For native tokens like ETH, use the WETH address
    `,
    schema: BridgeTokenSchema,
  })
  async bridgeToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BridgeTokenSchema>,
  ): Promise<string> {
    try {
      // Check if wallet is on the correct network
      const currentNetwork = walletProvider.getNetwork();
      
      try {
        // Use dynamic import to get the Across SDK
        const acrossModule = await import("@across-protocol/app-sdk");
        const createAcrossClient = acrossModule.createAcrossClient;
        
        // Convert string addresses to Hex type
        const inputToken = args.inputToken as Hex;
        const outputToken = args.outputToken as Hex;
        const recipient = (args.recipient || walletProvider.getAddress()) as Hex;
        
        // Create Across client
        const acrossClient = createAcrossClient({
          //integratorId: INTEGRATOR_ID,
          chains: [arbitrum, optimism, baseSepolia, sepolia],
          //useTestnet: true,
        });
        console.log("acrossClient", acrossClient);

        // Define route with proper types
        const route = {
            originChainId: arbitrum.id,
            destinationChainId: optimism.id,
            inputToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as Hex, // WETH arb
            outputToken: "0x4200000000000000000000000000000000000006" as Hex, // WETH opt
        };
        console.log("route", route);
        
        // Get token decimals for amount parsing
        const decimals = 18;
        const inputAmount = parseUnits(args.amount, decimals);
        
        // Get quote
        const quote = await acrossClient.getQuote({
          route,
          inputAmount: parseEther("1"),
          recipient,
        });
        console.log("quote", quote);
        return `
Successfully retrieved bridge quote:
- From: Chain ${currentNetwork}
- To: Chain ${args.destinationChainId}
- Token: ${args.inputToken} → ${args.outputToken}
- Amount: ${args.amount}
- Recipient: ${recipient}
        `;
      } catch (innerError) {
        // Handle SDK-specific errors
        return `Error with Across SDK: ${innerError}`;
      }
    } catch (error) {
      return `Error bridging token: ${error}`;
    }
  }
  
  /**
   * Checks if the Across action provider supports the given network.
   * 
   * @param network - The network to check.
   * @returns True if the Across action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => {
    // Across only supports EVM-compatible chains
    return network.protocolFamily === "evm";
  };
}

export const acrossActionProvider = () => new AcrossActionProvider();
