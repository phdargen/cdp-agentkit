import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import { DynamicSvmWalletClient } from "@dynamic-labs-wallet/node-svm";
import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";
/**
 * Configuration options for the Dynamic wallet provider.
 *
 * @interface
 */
export interface DynamicWalletConfig {
  /** The Dynamic authentication token */
  authToken: string;
  /** The Dynamic environment ID */
  environmentId: string;
  /** The ID of the wallet to use, if not provided a new wallet will be created */
  walletId?: string;
  /** The chain ID to use for the wallet (for EVM) */
  chainId?: string;
  /** The network ID to use for the wallet (for SVM) */
  networkId?: string;
  /** The type of wallet to create */
  chainType: "ethereum" | "solana";
  /** The threshold signature scheme to use for wallet creation */
  thresholdSignatureScheme?: string;
  /** Optional password for encrypted backup shares */
  password?: string;
}

export type DynamicWalletExport = {
  walletId: string;
  chainId: string | undefined;
  networkId: string | undefined;
};

type CreateDynamicWalletReturnType = {
  wallet: {
    accountAddress: string;
    publicKeyHex?: string; // Only for EVM
    rawPublicKey: Uint8Array;
    externalServerKeyShares: unknown[]; // Specify a more appropriate type if known
  };
  dynamic: DynamicEvmWalletClient | DynamicSvmWalletClient;
};

/**
 * Converts a string threshold signature scheme to the enum value
 *
 * @param scheme - The string representation of the threshold signature scheme
 * @returns The corresponding ThresholdSignatureScheme enum value
 */
const convertThresholdSignatureScheme = (scheme?: string): ThresholdSignatureScheme => {
  if (scheme === "TWO_OF_THREE") return ThresholdSignatureScheme.TWO_OF_THREE;
  if (scheme === "THREE_OF_FIVE") return ThresholdSignatureScheme.THREE_OF_FIVE;
  return ThresholdSignatureScheme.TWO_OF_TWO;
};
/**
 * Create a Dynamic client based on the chain type
 *
 * @param config - The configuration options for the Dynamic client
 * @returns The created Dynamic client
 */
export const createDynamicClient = async (config: DynamicWalletConfig) => {
  const clientConfig = {
    authToken: config.authToken,
    environmentId: config.environmentId,
  };

  try {
    const client =
      config.chainType === "ethereum"
        ? new DynamicEvmWalletClient(clientConfig)
        : new DynamicSvmWalletClient(clientConfig);

    console.log("[createDynamicClient] Client created successfully");
    await client.authenticateApiToken(config.authToken);
    console.log("[createDynamicClient] Client authenticated successfully");
    return client;
  } catch (error) {
    console.error("[createDynamicClient] Error creating client:", error);
    throw error;
  }
};

/**
 * Create a Dynamic wallet
 *
 * @param config - The configuration options for the Dynamic wallet
 * @returns The created Dynamic wallet and client
 */
export const createDynamicWallet = async (
  config: DynamicWalletConfig,
): Promise<CreateDynamicWalletReturnType> => {
  console.log("[createDynamicWallet] Starting wallet creation with config:", {
    chainType: config.chainType,
    networkId: config.networkId,
  });

  const client = await createDynamicClient(config);
  console.log("[createDynamicWallet] Dynamic client created");

  let wallet: CreateDynamicWalletReturnType["wallet"];
  if (config.walletId) {
    console.log("[createDynamicWallet] Using existing wallet ID:", config.walletId);
    if (config.chainType === "solana") {
      const svmClient = client as DynamicSvmWalletClient;
      const result = await svmClient.deriveAccountAddress(
        new TextEncoder().encode(config.walletId),
      );
      wallet = {
        accountAddress: result.accountAddress,
        rawPublicKey: new Uint8Array(),
        externalServerKeyShares: [],
      };
    } else {
      throw new Error("deriveAccountAddress is only supported for Solana wallets");
    }
  } else {
    console.log("[createDynamicWallet] Creating new wallet");
    console.log("[createDynamicWallet] createWalletAccount params:", {
      thresholdSignatureScheme:
        config.thresholdSignatureScheme || ThresholdSignatureScheme.TWO_OF_TWO,
      password: config.password ? "***" : undefined,
      networkId: config.networkId,
      chainType: config.chainType,
    });

    const thresholdSignatureScheme = convertThresholdSignatureScheme(
      config.thresholdSignatureScheme,
    );
    try {
      const result = await (client as DynamicEvmWalletClient).createWalletAccount({
        thresholdSignatureScheme,
        password: config.password,
      });
      wallet = {
        accountAddress: result.accountAddress,
        rawPublicKey: result.rawPublicKey,
        externalServerKeyShares: result.externalServerKeyShares,
      };
    } catch (error) {
      throw new Error("Failed to create wallet: " + error);
    }
  }

  console.log("[createDynamicWallet] Wallet created/retrieved:", {
    accountAddress: wallet.accountAddress,
  });

  return { wallet, dynamic: client };
};
