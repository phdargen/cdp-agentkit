import { Hex, erc20Abi, formatUnits } from "viem";
import { AxiosError } from "axios";
import { EvmWalletProvider } from "../../wallet-providers";

/**
 * Interface for token details
 */
export interface TokenDetails {
  name: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
}

/**
 * Gets the details of an ERC20 token including name, decimals, and balance.
 *
 * @param walletProvider - The wallet provider to use for the multicall.
 * @param contractAddress - The contract address of the ERC20 token.
 * @param address - The address to check the balance for. If not provided, uses the wallet's address.
 * @returns A promise that resolves to TokenDetails or null if there's an error.
 */
export async function getTokenDetails(
  walletProvider: EvmWalletProvider,
  contractAddress: string,
  address?: string,
): Promise<TokenDetails | null> {
  try {
    const results = await walletProvider.getPublicClient().multicall({
      contracts: [
        {
          address: contractAddress as Hex,
          abi: erc20Abi,
          functionName: "name",
          args: [],
        },
        {
          address: contractAddress as Hex,
          abi: erc20Abi,
          functionName: "decimals",
          args: [],
        },
        {
          address: contractAddress as Hex,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [(address || walletProvider.getAddress()) as Hex],
        },
      ],
    });

    const name = results[0].result;
    const decimals = results[1]?.result;
    const balance = results[2]?.result;

    if (balance === undefined || decimals === undefined || name === undefined) {
      return null;
    }

    const formattedBalance = formatUnits(BigInt(balance), decimals);

    return {
      name,
      decimals,
      balance: BigInt(balance),
      formattedBalance,
    };
  } catch {
    return null;
  }
}

/**
 * Handles HTTP errors from Bankr API calls and returns a formatted error string.
 *
 * @param error - The Axios error object.
 * @param endpoint - The API endpoint that was called.
 * @returns A formatted error string.
 */
export function handleBankrHttpError(error: AxiosError, endpoint: string): string {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    if (status === 402) {
      return JSON.stringify({
        success: false,
        error: "Payment required",
        details: `The Bankr API endpoint ${endpoint} requires payment.`,
        paymentInfo: data,
      });
    }

    if (status >= 400 && status < 500) {
      return JSON.stringify({
        success: false,
        error: "Client error",
        details: `Bad request to ${endpoint}: ${(data as { message?: string })?.message || error.message}`,
        status,
      });
    }

    if (status >= 500) {
      return JSON.stringify({
        success: false,
        error: "Server error",
        details: `Server error at ${endpoint}: ${(data as { message?: string })?.message || error.message}`,
        status,
      });
    }
  }

  if (error.request) {
    return JSON.stringify({
      success: false,
      error: "Network error",
      details: `No response from ${endpoint}. Check your internet connection.`,
    });
  }

  return JSON.stringify({
    success: false,
    error: "Unknown error",
    details: `Failed to call ${endpoint}: ${error.message}`,
  });
}

/**
 * Gets the allowance for a spender address for a specific ERC20 token.
 *
 * @param walletProvider - The wallet provider to use.
 * @param tokenAddress - The contract address of the ERC20 token.
 * @param ownerAddress - The address of the token owner.
 * @param spenderAddress - The address of the spender.
 * @returns A promise that resolves to the allowance amount or null if there's an error.
 */
export async function getAllowance(
  walletProvider: EvmWalletProvider,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
): Promise<bigint | null> {
  try {
    const allowance = await walletProvider.getPublicClient().readContract({
      address: tokenAddress as Hex,
      abi: erc20Abi,
      functionName: "allowance",
      args: [ownerAddress as Hex, spenderAddress as Hex],
    });

    return BigInt(allowance);
  } catch {
    return null;
  }
}
