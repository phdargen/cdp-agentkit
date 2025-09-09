import {
  parseEther,
  encodeAbiParameters,
  encodeFunctionData,
  zeroAddress,
  Address,
  Hex,
  maxUint256,
  decodeEventLog,
  TransactionReceipt,
} from "viem";
import {
  FLETHAddress,
  FLETHHooksAddress,
  FlaunchPositionManagerAddress,
  IV4RouterAbiExactInput,
  IV4RouterAbiExactOutput,
  V4Actions,
  URCommands,
  UNIVERSAL_ROUTER_ABI,
  POSITION_MANAGER_ABI,
} from "./constants";
import { BuySwapAmounts, SellSwapAmounts, PermitSingle, PoolSwapEventArgs } from "./types";

/**
 * Upload response from Flaunch API
 */
interface FlaunchImageUploadResponse {
  success: boolean;
  ipfsHash: string;
  tokenURI: string;
  nsfwDetection: null | {
    isNSFW: boolean;
    score: number;
    message: string;
    details: any[];
  };
}

/**
 * Upload response from Flaunch metadata API
 */
interface FlaunchMetadataUploadResponse {
  success: boolean;
  ipfsHash: string;
  tokenURI: string;
}

interface FlaunchMetadataRequest {
  name: string;
  symbol: string;
  description: string;
  imageIpfs: string;
  websiteUrl?: string;
  discordUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

interface TokenUriParams {
  metadata: {
    imageUrl: string;
    description: string;
    websiteUrl?: string;
    discordUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
  };
}

/**
 * Uploads a base64 image to IPFS using Flaunch API
 *
 * @param base64Image - Base64 encoded image data (with or without data URL prefix)
 * @returns Upload response with IPFS hash and token URI
 */
const uploadImageToFlaunch = async (base64Image: string): Promise<FlaunchImageUploadResponse> => {
  try {
    // Ensure the base64Image has the proper data URL format
    let formattedBase64Image = base64Image;
    if (!base64Image.startsWith("data:")) {
      // Default to JPEG if no prefix is provided
      formattedBase64Image = `data:image/jpeg;base64,${base64Image}`;
    }

    const response = await fetch("https://web2-api.flaunch.gg/api/v1/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Image: formattedBase64Image,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload image to Flaunch API: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Failed to upload image: ${data.error}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload image to Flaunch API: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Converts a remote image URL to a properly formatted base64 data URL
 *
 * @param imageUrl - URL of the image to fetch and convert
 * @returns Base64 data URL with proper MIME type detection
 */
const convertImageUrlToBase64 = async (imageUrl: string): Promise<string> => {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    
    // Detect MIME type from response headers
    const contentType = response.headers.get("content-type");
    let mimeType = "image/jpeg"; // default fallback
    
    if (contentType && contentType.startsWith("image/")) {
      mimeType = contentType;
    } else {
      // Try to detect from URL extension as fallback
      const urlLower = imageUrl.toLowerCase();
      if (urlLower.includes(".png")) {
        mimeType = "image/png";
      } else if (urlLower.includes(".gif")) {
        mimeType = "image/gif";
      } else if (urlLower.includes(".webp")) {
        mimeType = "image/webp";
      } else if (urlLower.includes(".svg")) {
        mimeType = "image/svg+xml";
      }
    }
    
    return `data:${mimeType};base64,${base64Data}`;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to convert image URL to base64: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Uploads metadata to IPFS using Flaunch API
 *
 * @param metadata - Token metadata including name, symbol, description, etc.
 * @returns Upload response with IPFS hash and token URI
 */
const uploadMetadataToFlaunch = async (metadata: FlaunchMetadataRequest): Promise<FlaunchMetadataUploadResponse> => {
  try {
    const response = await fetch("https://web2-api.flaunch.gg/api/v1/upload-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload metadata to Flaunch API: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Failed to upload metadata: ${data.error}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload metadata to Flaunch API: ${error.message}`);
    }
    throw error;
  }
};

export const generateTokenUri = async (name: string, symbol: string, params: TokenUriParams) => {
  // 1. Convert image URL to properly formatted base64 data URL
  const formattedBase64Image = await convertImageUrlToBase64(params.metadata.imageUrl);

  // 2. Upload image to Flaunch API
  const imageRes = await uploadImageToFlaunch(formattedBase64Image);

  // 3. Upload metadata to Flaunch API
  const metadataRequest: FlaunchMetadataRequest = {
    name,
    symbol,
    description: params.metadata.description,
    imageIpfs: imageRes.ipfsHash,
    websiteUrl: params.metadata.websiteUrl,
    discordUrl: params.metadata.discordUrl,
    twitterUrl: params.metadata.twitterUrl,
    telegramUrl: params.metadata.telegramUrl,
  };

  const metadataRes = await uploadMetadataToFlaunch(metadataRequest);

  return metadataRes.tokenURI;
};

export const getAmountWithSlippage = (
  amount: bigint | undefined,
  slippage: string,
  swapType: "EXACT_IN" | "EXACT_OUT",
) => {
  if (amount == null) {
    return 0n;
  }

  const absAmount = amount < 0n ? -amount : amount;
  const slippageMultiplier =
    swapType === "EXACT_IN"
      ? BigInt(1e18) - parseEther(slippage)
      : BigInt(1e18) + parseEther(slippage);

  return (absAmount * slippageMultiplier) / BigInt(1e18);
};

const ETH = zeroAddress;

export const ethToMemecoin = (params: {
  sender: Address;
  memecoin: Address;
  chainId: number;
  referrer: Address | null;
  swapType: "EXACT_IN" | "EXACT_OUT";
  amountIn?: bigint; // Required for 'EXACT_IN' swap
  amountOutMin?: bigint; // Required for 'EXACT_IN' swap
  amountOut?: bigint; // Required for 'EXACT_OUT' swap
  amountInMax?: bigint; // Required for 'EXACT_OUT' swap
}) => {
  const flETH = FLETHAddress[params.chainId];
  const flETHHooks = FLETHHooksAddress[params.chainId];
  const flaunchHooks = FlaunchPositionManagerAddress[params.chainId];

  // Determine actions based on swapType
  const v4Actions = ("0x" +
    (params.swapType === "EXACT_IN" ? V4Actions.SWAP_EXACT_IN : V4Actions.SWAP_EXACT_OUT) +
    V4Actions.SETTLE_ALL +
    V4Actions.TAKE_ALL) as Hex;

  // Initialize variables for path and v4Params
  let path;
  let v4Params;

  // Configure path and parameters based on swapType
  if (params.swapType === "EXACT_IN") {
    if (params.amountIn == null || params.amountOutMin == null) {
      throw new Error("amountIn and amountOutMin are required for EXACT_IN swap");
    }

    // Path for 'EXACT_IN' swap
    path = [
      {
        intermediateCurrency: flETH,
        fee: 0,
        tickSpacing: 60,
        hooks: flETHHooks,
        hookData: "0x" as Address,
      },
      {
        intermediateCurrency: params.memecoin,
        fee: 0,
        tickSpacing: 60,
        hooks: flaunchHooks,
        hookData: encodeAbiParameters(
          [{ type: "address", name: "referrer" }],
          [params.referrer ?? zeroAddress],
        ),
      },
    ];

    // Parameters for 'EXACT_IN' swap
    v4Params = encodeAbiParameters(IV4RouterAbiExactInput, [
      {
        currencyIn: ETH,
        path: path,
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMin,
      },
    ]);
  } else {
    if (params.amountOut == null || params.amountInMax == null) {
      throw new Error("amountOut and amountInMax are required for EXACT_OUT swap");
    }

    // Path for 'EXACT_OUT' swap
    path = [
      {
        fee: 0,
        tickSpacing: 60,
        hookData: "0x" as `0x${string}`,
        hooks: flETHHooks,
        intermediateCurrency: ETH,
      },
      {
        fee: 0,
        tickSpacing: 60,
        hooks: flaunchHooks,
        intermediateCurrency: flETH,
        hookData: encodeAbiParameters(
          [{ type: "address", name: "referrer" }],
          [params.referrer ?? zeroAddress],
        ) as `0x${string}`,
      },
    ];

    // Parameters for 'EXACT_OUT' swap
    v4Params = encodeAbiParameters(IV4RouterAbiExactOutput, [
      {
        currencyOut: params.memecoin,
        path: path,
        amountOut: params.amountOut,
        amountInMaximum: params.amountInMax,
      },
    ]);
  }

  // Common parameters for both swap types
  const settleParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "maxAmount",
      },
    ],
    [
      ETH,
      params.swapType === "EXACT_IN"
        ? (params.amountIn ?? maxUint256)
        : (params.amountInMax ?? maxUint256),
    ],
  );

  const takeParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "minAmount",
      },
    ],
    [
      params.memecoin,
      params.swapType === "EXACT_IN"
        ? (params.amountOutMin ?? maxUint256)
        : (params.amountOut ?? maxUint256),
    ],
  );

  // Encode router data
  const v4RouterData = encodeAbiParameters(
    [
      { type: "bytes", name: "actions" },
      { type: "bytes[]", name: "params" },
    ],
    [v4Actions, [v4Params, settleParams, takeParams]],
  );

  // Commands for Universal Router
  const urCommands = ("0x" + URCommands.V4_SWAP + URCommands.SWEEP) as Hex;
  const sweepInput = encodeAbiParameters(
    [
      { type: "address", name: "token" },
      { type: "address", name: "recipient" },
      { type: "uint160", name: "amountIn" },
    ],
    [ETH, params.sender, 0n],
  );

  // Encode calldata for Universal Router
  const inputs = [v4RouterData, sweepInput];
  const urExecuteCalldata = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [urCommands, inputs],
  });

  return {
    calldata: urExecuteCalldata,
    commands: urCommands,
    inputs,
  };
};

// @notice Before calling the UniversalRouter the user must have:
// 1. Given the Permit2 contract allowance to spend the memecoin
export const memecoinToEthWithPermit2 = (params: {
  chainId: number;
  memecoin: Address;
  amountIn: bigint;
  ethOutMin: bigint;
  permitSingle: PermitSingle | undefined;
  signature: Hex | undefined;
  referrer: Address | null;
}) => {
  const flETH = FLETHAddress[params.chainId];

  const flETHHooks = FLETHHooksAddress[params.chainId];
  const flaunchHooks = FlaunchPositionManagerAddress[params.chainId];
  const v4Actions = ("0x" +
    V4Actions.SWAP_EXACT_IN +
    V4Actions.SETTLE_ALL +
    V4Actions.TAKE_ALL) as Hex;
  const v4ExactInputParams = encodeAbiParameters(IV4RouterAbiExactInput, [
    {
      currencyIn: params.memecoin,
      path: [
        {
          intermediateCurrency: flETH,
          fee: 0,
          tickSpacing: 60,
          hooks: flaunchHooks,
          hookData: encodeAbiParameters(
            [
              {
                type: "address",
                name: "referrer",
              },
            ],
            [params.referrer ?? zeroAddress],
          ),
        },
        {
          intermediateCurrency: ETH,
          fee: 0,
          tickSpacing: 60,
          hooks: flETHHooks,
          hookData: "0x",
        },
      ],
      amountIn: params.amountIn,
      amountOutMinimum: params.ethOutMin,
    },
  ]);

  const settleParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "maxAmount",
      },
    ],
    [params.memecoin, params.amountIn],
  );

  const takeParams = encodeAbiParameters(
    [
      {
        type: "address",
        name: "currency",
      },
      {
        type: "uint256",
        name: "minAmount",
      },
    ],
    [ETH, params.ethOutMin],
  );

  const v4RouterData = encodeAbiParameters(
    [
      { type: "bytes", name: "actions" },
      { type: "bytes[]", name: "params" },
    ],
    [v4Actions, [v4ExactInputParams, settleParams, takeParams]],
  );

  if (params.signature && params.permitSingle) {
    const urCommands = ("0x" + URCommands.PERMIT2_PERMIT + URCommands.V4_SWAP) as Hex;

    const permit2PermitInput = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            {
              type: "tuple",
              components: [
                { type: "address", name: "token" },
                { type: "uint160", name: "amount" },
                { type: "uint48", name: "expiration" },
                { type: "uint48", name: "nonce" },
              ],
              name: "details",
            },
            { type: "address", name: "spender" },
            { type: "uint256", name: "sigDeadline" },
          ],
          name: "PermitSingle",
        },
        { type: "bytes", name: "signature" },
      ],
      [params.permitSingle, params.signature],
    );

    const inputs = [permit2PermitInput, v4RouterData];
    const urExecuteCalldata = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [urCommands, inputs],
    });

    return {
      calldata: urExecuteCalldata,
      commands: urCommands,
      inputs,
    };
  } else {
    const urCommands = ("0x" + URCommands.V4_SWAP) as Hex;

    const inputs = [v4RouterData];
    const urExecuteCalldata = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [urCommands, inputs],
    });

    return {
      calldata: urExecuteCalldata,
      commands: urCommands,
      inputs,
    };
  }
};

export const getSwapAmountsFromLog = ({
  filteredPoolSwapEvent,
  coinAddress,
  chainId,
}: {
  filteredPoolSwapEvent: PoolSwapEventArgs;
  coinAddress: Address;
  chainId: number;
}): BuySwapAmounts | SellSwapAmounts => {
  const {
    flAmount0,
    flAmount1,
    flFee0,
    flFee1,
    ispAmount0,
    ispAmount1,
    ispFee0,
    ispFee1,
    uniAmount0,
    uniAmount1,
    uniFee0,
    uniFee1,
  } = filteredPoolSwapEvent;

  const currency0Delta = flAmount0 + ispAmount0 + uniAmount0;
  const currency1Delta = flAmount1 + ispAmount1 + uniAmount1;
  const currency0Fees = flFee0 + ispFee0 + uniFee0;
  const currency1Fees = flFee1 + ispFee1 + uniFee1;

  let feesIsInFLETH: boolean;
  let swapType: "BUY" | "SELL";
  const flETHIsCurrencyZero = coinAddress > FLETHAddress[chainId];

  if (flETHIsCurrencyZero) {
    swapType = currency0Delta < 0 ? "BUY" : "SELL";
    feesIsInFLETH = currency0Fees < 0;
  } else {
    swapType = currency1Delta < 0 ? "BUY" : "SELL";
    feesIsInFLETH = currency1Fees < 0;
  }

  const absCurrency0Delta = currency0Delta < 0 ? -currency0Delta : currency0Delta;
  const absCurrency1Delta = currency1Delta < 0 ? -currency1Delta : currency1Delta;
  const absCurrency0Fees = currency0Fees < 0 ? -currency0Fees : currency0Fees;
  const absCurrency1Fees = currency1Fees < 0 ? -currency1Fees : currency1Fees;

  const fees = {
    isInFLETH: feesIsInFLETH,
    amount: flETHIsCurrencyZero
      ? feesIsInFLETH
        ? absCurrency0Fees
        : absCurrency1Fees
      : feesIsInFLETH
        ? absCurrency1Fees
        : absCurrency0Fees,
  };

  if (swapType === "BUY") {
    return {
      coinsBought: flETHIsCurrencyZero
        ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
        : absCurrency0Delta - (!fees.isInFLETH ? fees.amount : 0n),
      ethSold: flETHIsCurrencyZero
        ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
        : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
    };
  } else {
    return {
      coinsSold: flETHIsCurrencyZero
        ? absCurrency1Delta - (!fees.isInFLETH ? fees.amount : 0n)
        : absCurrency0Delta - (!fees.isInFLETH ? fees.amount : 0n),
      ethBought: flETHIsCurrencyZero
        ? absCurrency0Delta - (fees.isInFLETH ? fees.amount : 0n)
        : absCurrency1Delta - (fees.isInFLETH ? fees.amount : 0n),
    };
  }
};

export const getSwapAmountsFromReceipt = ({
  receipt,
  coinAddress,
  chainId,
}: {
  receipt: TransactionReceipt;
  coinAddress: Address;
  chainId: number;
}) => {
  const filteredPoolSwapEvent = receipt.logs
    .map(log => {
      try {
        if (log.address.toLowerCase() !== FlaunchPositionManagerAddress[chainId].toLowerCase()) {
          return null;
        }

        const event = decodeEventLog({
          abi: POSITION_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "PoolSwap" ? event.args : null;
      } catch {
        return null;
      }
    })
    .filter((event): event is NonNullable<typeof event> => event !== null)[0];

  return getSwapAmountsFromLog({
    filteredPoolSwapEvent,
    coinAddress,
    chainId,
  });
};
