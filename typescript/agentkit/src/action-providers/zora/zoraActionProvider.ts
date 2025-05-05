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
- image: Local image file path or URI (ipfs:// or https://)
- description: The description of the coin
- payoutRecipient: The address that will receive creator earnings (optional, defaults to the wallet address)
- platformReferrer: The address that will receive platform referrer fees (optional, defaults to 0x0000000000000000000000000000000000000000)
- initialPurchase: The initial purchase amount in whole units of ETH, e.g. 1.5 for 1.5 ETH (optional, defaults to 0)
- category: The category of the coin (optional, defaults to 'social')
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
      // Generate token URI from local file or URI
      const { uri, imageUri } = await generateZoraTokenUri({
        name: args.name,
        symbol: args.symbol,
        description: args.description,
        image: args.image,
        category: args.category,
        pinataConfig: { jwt: this.#pinataJwt },
      });
      console.log("Token URI:", uri);
      console.log("Image URI:", imageUri);

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

      // Create the coin using Zora SDK
      const result = await zoraModule.createCoin(
        {
          name: args.name,
          symbol: args.symbol,
          uri: uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/"),
          payoutRecipient: (args.payoutRecipient as Hex) || this.#account.address,
          platformReferrer:
            (args.platformReferrer as Hex) || "0x0000000000000000000000000000000000000000",
          initialPurchaseWei: parseUnits(args.initialPurchase || "0", 18),
        },
        walletClient,
        publicClient,
        {
          gasMultiplier: 200,
        },
      );

      console.log("result:", result);
      if(result.receipt.status === "success") {
        return JSON.stringify({
          success: true,
          transactionHash: result.hash,
          coinAddress: result.address,
          imageUri: imageUri,
          uri: uri,
          deployment: result.deployment,
        });
      } else {
        throw new Error("Coin creation transaction reverted");
      }
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
