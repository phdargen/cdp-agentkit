import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { CreateCoinSchema } from "./schemas";
import { CreateAction } from "../actionDecorator";
import { Hex, createPublicClient, http, createWalletClient, parseUnits } from "viem";
import { Network, NETWORK_ID_TO_VIEM_CHAIN } from "../../network";
import { privateKeyToAccount } from "viem/accounts";
import { 
  generateZoraTokenUri, 
  checkPinataPin
} from "./utils";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

export interface ZoraActionProviderConfig {
  /**
   * RPC URL to use for public client
   */
  RPC_URL?: string;
  /**
   * Private key of the wallet provider
   */
  privateKey: string;
  /**
   * Pinata JWT for IPFS uploads
   */
  pinataJwt?: string;
}

/**
 * Schema for IPFS debugging
 */
const DebugPinataSchema = z.object({
  ipfsHash: z.string().describe("IPFS hash (CID) to check if pinned on Pinata"),
});

/**
 * ZoraActionProvider provides actions for interacting with the Zora protocol.
 */
export class ZoraActionProvider extends ActionProvider<EvmWalletProvider> {
  #privateKey: string;
  #account: ReturnType<typeof privateKeyToAccount>;
  #pinataJwt: string;

  /**
   * Constructor for the ZoraActionProvider.
   *
   * @param config - The configuration options for the ZoraActionProvider.
   */
  constructor(config: ZoraActionProviderConfig) {
    super("zora", []);
    this.#privateKey = config.privateKey;

    // Validate private key and create account
    this.#account = privateKeyToAccount(this.#privateKey as Hex);
    if (!this.#account) throw new Error("Invalid private key");

    // Set Pinata JWT
    const pinataJwt = config.pinataJwt || process.env.PINATA_JWT;
    if (!pinataJwt) {
      throw new Error("PINATA_JWT is not configured. Required for IPFS uploads.");
    }
    this.#pinataJwt = pinataJwt;
  }

  /**
   * Creates a new coin on the Zora protocol.
   *
   * @param walletProvider - The wallet provider to use for the transaction.
   * @param args - The input arguments for the action.
   * @returns A message containing the coin creation details.
   */
  @CreateAction({
    name: "createCoin",
    description: `
This tool will create a new coin on Zora protocol.
It takes the following parameters:
- name: The name of the coin
- symbol: The symbol of the coin
- imageFileName: The name of the image file to upload to IPFS
- description: The description of the coin
- payoutRecipient: The address that will receive creator earnings (optional, defaults to the wallet address)
- platformReferrer: The address that will receive platform referrer fees (optional, defaults to 0x0000000000000000000000000000000000000000)
- initialPurchase: The initial purchase amount in whole units of ETH (e.g. 1.5 for 1.5 ETH), defaults to 0
The action will return the transaction hash, coin address, and deployment details upon success.
`,
    schema: CreateCoinSchema,
  })
  async createCoin(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateCoinSchema>,
  ): Promise<string> {
    console.log("Creating coin with args:", args);
    try {
      // Generate token URI from local file
      const { uri, metadataHash, imageHash } = await generateZoraTokenUri({
        name: args.name,
        symbol: args.symbol,
        description: args.description,
        imageFileName: args.imageFileName,
        pinataConfig: { jwt: this.#pinataJwt },
      });
      console.log("Token URI:", uri);
      console.log("Metadata Hash:", metadataHash);
      console.log("Image Hash:", imageHash);

      // Verify content is pinned on Pinata before proceeding
      console.log("Verifying content is pinned on Pinata...");
      const isImagePinned = await checkPinataPin(imageHash, { jwt: this.#pinataJwt });
      const isMetadataPinned = await checkPinataPin(metadataHash, { jwt: this.#pinataJwt });

      if (!isImagePinned || !isMetadataPinned) {
        throw new Error("IPFS content not properly pinned after multiple retries. Please try again later.");
      }
      
      console.log("IPFS content confirmed pinned. Proceeding with coin creation...");

      // Create public client
      const networkId = walletProvider.getNetwork().networkId as string;
      const publicClient = createPublicClient({
        chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
        transport: http(),
      });

      // Create wallet client
      const walletClient = createWalletClient({
        account: this.#account,
        chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
        transport: http(),
      });

      // Validate that wallet matches the provider
      if (this.#account.address.toLowerCase() !== walletProvider.getAddress().toLowerCase()) {
        throw new Error("Private key does not match wallet provider address");
      }

      // Dynamically import Zora SDK to handle ESM/CommonJS compatibility
      const zoraModule = await import("@zoralabs/coins-sdk");

      // Add delay and retry logic for coin creation
      const maxRetries = 5;
      const retryDelay = 15000; // 15 seconds between retries
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempting to create coin (attempt ${attempt}/${maxRetries})...`);
          
          if (attempt > 1) {
            console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          // Create the coin using Zora SDK
          const result = await zoraModule.createCoin(
            {
              name: args.name,
              symbol: args.symbol,
              uri,
              payoutRecipient: (args.payoutRecipient as Hex) || this.#account.address,
              platformReferrer:
                (args.platformReferrer as Hex) || "0x0000000000000000000000000000000000000000",
              initialPurchaseWei: parseUnits(args.initialPurchase || "0", 18),
            },
            walletClient,
            publicClient,
          );
          
          return JSON.stringify({
            success: true,
            hash: result.hash,
            address: result.address,
            deployment: result.deployment,
          });
        } catch (error: unknown) {
          console.error(`Error on attempt ${attempt}:`, error);
          lastError = error;
          
          // Check if error is related to metadata fetch
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes("Metadata fetch failed")) {
            // If it's not a metadata fetch issue, don't retry
            throw error;
          }
          
          // If this was the last attempt, throw the error
          if (attempt === maxRetries) {
            throw error;
          }
        }
      }

      throw lastError || new Error("Failed to create coin after multiple retries");
    } catch (error: unknown) {
      console.error("Error creating coin:", error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Checks if the Zora action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Zora action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

/**
 * Factory function to create a new ZoraActionProvider instance.
 *
 * @param config - Configuration options for the ZoraActionProvider
 * @returns A new ZoraActionProvider instance
 */
export const zoraActionProvider = (config: ZoraActionProviderConfig) =>
  new ZoraActionProvider(config);
