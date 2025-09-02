import { erc20ActionProvider } from "./erc20ActionProvider";
import { TransferSchema, GetTokenAddressSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";
import { encodeFunctionData, Hex } from "viem";
import { erc20Abi as abi } from "viem";

const MOCK_AMOUNT = 15;
const MOCK_DECIMALS = 6;
const MOCK_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";
const MOCK_DESTINATION = "0x9876543210987654321098765432109876543210";
const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890";

describe("Transfer Schema", () => {
  it("should successfully parse valid input", () => {
    const validInput = {
      amount: MOCK_AMOUNT,
      contractAddress: MOCK_CONTRACT_ADDRESS,
      destination: MOCK_DESTINATION,
    };

    const result = TransferSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validInput);
  });

  it("should fail parsing empty input", () => {
    const emptyInput = {};
    const result = TransferSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });
});

describe("Get Balance Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = erc20ActionProvider();

  beforeEach(async () => {
    mockWallet = {
      getAddress: jest.fn().mockReturnValue(MOCK_ADDRESS),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("should successfully respond", async () => {
    mockWallet.readContract.mockResolvedValueOnce(MOCK_AMOUNT);
    mockWallet.readContract.mockResolvedValueOnce(MOCK_DECIMALS);

    const args = {
      tokenAddress: MOCK_CONTRACT_ADDRESS,
    };

    const response = await actionProvider.getBalance(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledWith({
      address: args.tokenAddress as Hex,
      abi,
      functionName: "balanceOf",
      args: [mockWallet.getAddress()],
    });
    expect(response).toContain(
      `Balance of ${MOCK_CONTRACT_ADDRESS} is ${MOCK_AMOUNT / 10 ** MOCK_DECIMALS}`,
    );
  });

  it("should fail with an error", async () => {
    const args = {
      tokenAddress: MOCK_CONTRACT_ADDRESS,
    };

    const error = new Error("Failed to get balance");
    mockWallet.readContract.mockRejectedValue(error);

    const response = await actionProvider.getBalance(mockWallet, args);

    expect(mockWallet.readContract).toHaveBeenCalledWith({
      address: args.tokenAddress as Hex,
      abi,
      functionName: "balanceOf",
      args: [mockWallet.getAddress()],
    });

    expect(response).toContain(`Error getting balance: ${error}`);
  });
});

describe("Transfer Action", () => {
  const TRANSACTION_HASH = "0xghijkl987654321";

  let mockWallet: jest.Mocked<EvmWalletProvider>;

  const actionProvider = erc20ActionProvider();

  beforeEach(async () => {
    mockWallet = {
      sendTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
      getName: jest.fn().mockReturnValue("evm_wallet_provider"),
      getNetwork: jest.fn().mockReturnValue({
        networkId: "base-mainnet",
      }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockWallet.sendTransaction.mockResolvedValue(TRANSACTION_HASH);
    mockWallet.waitForTransactionReceipt.mockResolvedValue({});
  });

  it("should successfully respond", async () => {
    const args = {
      amount: BigInt(MOCK_AMOUNT),
      tokenAddress: MOCK_CONTRACT_ADDRESS,
      destinationAddress: MOCK_DESTINATION,
    };

    const response = await actionProvider.transfer(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: args.tokenAddress as Hex,
      data: encodeFunctionData({
        abi,
        functionName: "transfer",
        args: [args.destinationAddress as Hex, BigInt(args.amount)],
      }),
    });
    expect(mockWallet.waitForTransactionReceipt).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(response).toContain(
      `Transferred ${MOCK_AMOUNT} of ${MOCK_CONTRACT_ADDRESS} to ${MOCK_DESTINATION}`,
    );
    expect(response).toContain(`Transaction hash for the transfer: ${TRANSACTION_HASH}`);
  });

  it("should fail with an error", async () => {
    const args = {
      amount: BigInt(MOCK_AMOUNT),
      tokenAddress: MOCK_CONTRACT_ADDRESS,
      destinationAddress: MOCK_DESTINATION,
    };

    const error = new Error("Failed to execute transfer");
    mockWallet.sendTransaction.mockRejectedValue(error);

    const response = await actionProvider.transfer(mockWallet, args);

    expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
      to: args.tokenAddress as Hex,
      data: encodeFunctionData({
        abi,
        functionName: "transfer",
        args: [args.destinationAddress as Hex, BigInt(args.amount)],
      }),
    });
    expect(response).toContain(`Error transferring the asset: ${error}`);
  });

  describe("supportsNetwork", () => {
    it("should return true when protocolFamily is evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should return false when protocolFamily is not evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana" })).toBe(false);
    });
  });
});

describe("GetTokenAddress Schema", () => {
  it("should successfully parse valid token symbol", () => {
    const validInput = { symbol: "usdc" };
    const result = GetTokenAddressSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data?.symbol).toBe("USDC"); // Should be uppercase
  });

  it("should fail parsing empty symbol", () => {
    const emptyInput = { symbol: "" };
    const result = GetTokenAddressSchema.safeParse(emptyInput);

    expect(result.success).toBe(false);
  });

  it("should fail parsing symbol too long", () => {
    const longInput = { symbol: "VERYLONGTOKENSYMBOL" };
    const result = GetTokenAddressSchema.safeParse(longInput);

    expect(result.success).toBe(false);
  });
});

describe("Get Token Address Action", () => {
  let mockWallet: jest.Mocked<EvmWalletProvider>;
  const actionProvider = erc20ActionProvider();

  beforeEach(() => {
    mockWallet = {
      getNetwork: jest.fn(),
    } as any;
  });

  it("should return token address for valid symbol on base-mainnet", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "USDC" });
    expect(response).toContain("Token address for USDC on base-mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });

  it("should return token address for valid symbol on base-sepolia", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-sepolia",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "EURC" });
    expect(response).toContain("Token address for EURC on base-sepolia: 0x808456652fdb597867f38412077A9182bf77359F");
  });

  it("should return error for unsupported network", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "ethereum-mainnet",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "USDC" });
    expect(response).toContain("Error: Network ethereum-mainnet is not supported for token symbol lookup");
    expect(response).toContain("base-mainnet, base-sepolia");
  });

  it("should return error for unknown token symbol", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      networkId: "base-mainnet",
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "UNKNOWN" });
    expect(response).toContain('Error: Token symbol "UNKNOWN" not found on base-mainnet');
    expect(response).toContain("USDC, EURC, CBBTC");
  });

  it("should return error when network ID is not available", async () => {
    mockWallet.getNetwork.mockReturnValue({
      protocolFamily: "evm",
      // networkId is undefined
    });

    const response = await actionProvider.getTokenAddress(mockWallet, { symbol: "USDC" });
    expect(response).toContain("Error: Network ID is not available. Cannot perform token symbol lookup.");
  });
});
