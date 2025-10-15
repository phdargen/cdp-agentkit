import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  GetEnsAddressSchema,
  GetEnsNameSchema,
  GetEnsTextSchema,
  GetEnsAvatarSchema,
} from "./schemas";
import { normalize } from "viem/ens";
import { EvmWalletProvider } from "../../wallet-providers";
import { Hex } from "viem";

/**
 * ENSActionProvider is an action provider for ENS (Ethereum Name Service) operations.
 */
export class ENSActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the ENSActionProvider.
   */
  constructor() {
    super("ens", []);
  }

  /**
   * Resolves an ENS name to an Ethereum address.
   *
   * @param walletProvider - The wallet provider to use for resolution.
   * @param args - The input arguments for the action.
   * @returns A message containing the resolved address or an error.
   */
  @CreateAction({
    name: "get_ens_address",
    description: `
    This tool resolves an ENS (Ethereum Name Service) name to an Ethereum address.
    It takes the following input:
    - name: The ENS name to resolve (e.g., 'vitalik.eth')
    
    Important notes:
    - ENS names are case-insensitive and will be normalized
    - Returns the Ethereum address associated with the ENS name
    - Only works on Ethereum mainnet and testnets that support ENS
    `,
    schema: GetEnsAddressSchema,
  })
  async getEnsAddress(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetEnsAddressSchema>,
  ): Promise<string> {
    try {
      const normalizedName = normalize(args.name);
      const address = await walletProvider.getPublicClient().getEnsAddress({
        name: normalizedName,
      });

      if (!address) {
        return `ENS name "${args.name}" does not resolve to an address. The name may not be registered or may not have an address set.`;
      }

      return `ENS name "${args.name}" resolves to address: ${address}`;
    } catch (error) {
      return `Error resolving ENS name "${args.name}": ${error}`;
    }
  }

  /**
   * Performs reverse resolution of an Ethereum address to an ENS name.
   *
   * @param walletProvider - The wallet provider to use for resolution.
   * @param args - The input arguments for the action.
   * @returns A message containing the resolved ENS name or an error.
   */
  @CreateAction({
    name: "get_ens_name",
    description: `
    This tool performs reverse resolution to get the ENS name associated with an Ethereum address.
    It takes the following input:
    - address: The Ethereum address to resolve (e.g., '0x...')
    
    Important notes:
    - Not all addresses have ENS names set
    - Returns the primary ENS name if one is configured
    - Only works on Ethereum mainnet and testnets that support ENS
    `,
    schema: GetEnsNameSchema,
  })
  async getEnsName(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetEnsNameSchema>,
  ): Promise<string> {
    try {
      const ensName = await walletProvider.getPublicClient().getEnsName({
        address: args.address as Hex,
      });

      if (!ensName) {
        return `Address ${args.address} does not have an ENS name set.`;
      }

      return `Address ${args.address} has ENS name: ${ensName}`;
    } catch (error) {
      return `Error resolving address "${args.address}" to ENS name: ${error}`;
    }
  }

  /**
   * Gets a text record for an ENS name.
   *
   * @param walletProvider - The wallet provider to use for the query.
   * @param args - The input arguments for the action.
   * @returns A message containing the text record value or an error.
   */
  @CreateAction({
    name: "get_ens_text",
    description: `
    This tool retrieves a text record for an ENS name.
    It takes the following inputs:
    - name: The ENS name to query (e.g., 'vitalik.eth')
    - key: The text record key to retrieve
    
    Common text record keys include:
    - 'description': A description of the name
    - 'url': A website URL
    - 'avatar': Avatar image URL
    - 'email': Email address
    - 'com.twitter': Twitter handle
    - 'com.github': GitHub username
    - 'com.discord': Discord username
    
    Important notes:
    - Not all ENS names have text records set
    - Only works on Ethereum mainnet and testnets that support ENS
    `,
    schema: GetEnsTextSchema,
  })
  async getEnsText(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetEnsTextSchema>,
  ): Promise<string> {
    try {
      const normalizedName = normalize(args.name);
      const textRecord = await walletProvider.getPublicClient().getEnsText({
        name: normalizedName,
        key: args.key,
      });

      if (!textRecord) {
        return `ENS name "${args.name}" does not have a text record for key "${args.key}".`;
      }

      return `ENS name "${args.name}" has text record "${args.key}": ${textRecord}`;
    } catch (error) {
      return `Error retrieving text record "${args.key}" for ENS name "${args.name}": ${error}`;
    }
  }

  /**
   * Gets the avatar URL for an ENS name.
   *
   * @param walletProvider - The wallet provider to use for the query.
   * @param args - The input arguments for the action.
   * @returns A message containing the avatar URL or an error.
   */
  @CreateAction({
    name: "get_ens_avatar",
    description: `
    This tool retrieves the avatar URL for an ENS name.
    It takes the following input:
    - name: The ENS name to get the avatar for (e.g., 'vitalik.eth')
    
    Important notes:
    - Not all ENS names have avatars set
    - Returns a URL that can be used to display the avatar
    - Supports various avatar types (images, NFTs, etc.)
    - Only works on Ethereum mainnet and testnets that support ENS
    `,
    schema: GetEnsAvatarSchema,
  })
  async getEnsAvatar(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetEnsAvatarSchema>,
  ): Promise<string> {
    try {
      const normalizedName = normalize(args.name);
      const avatarUrl = await walletProvider.getPublicClient().getEnsAvatar({
        name: normalizedName,
      });

      if (!avatarUrl) {
        return `ENS name "${args.name}" does not have an avatar set.`;
      }

      return `ENS name "${args.name}" has avatar URL: ${avatarUrl}`;
    } catch (error) {
      return `Error retrieving avatar for ENS name "${args.name}": ${error}`;
    }
  }

  /**
   * Checks if the ENS action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the ENS action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => {
    return network.protocolFamily === "evm";
  };
}

export const ensActionProvider = () => new ENSActionProvider();

