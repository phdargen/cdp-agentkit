import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { PlaceBidSchema } from "./schemas";
import { abi } from "./constants";
import { encodeFunctionData, formatUnits, Hex, parseUnits } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import { ethers, JsonRpcProvider, WebSocketProvider } from "ethers";
import { BiddingStrategy, AuctionState } from "./types";
import { strategies } from "./strategies";

export interface PlaceholderActionProviderInterface {
  startMonitoring(walletProvider: EvmWalletProvider): Promise<void>;
}
/**
 * PlaceholderActionProvider is an action provider for the Placeholder Ads auction contract.
 */
export class PlaceholderActionProvider
  extends ActionProvider<EvmWalletProvider>
  implements PlaceholderActionProviderInterface
{
  private readonly contractAddress: string;
  private currentStrategy: BiddingStrategy;
  private auctionState: AuctionState;
  private wssProvider?: WebSocketProvider;
  private httpProvider?: JsonRpcProvider;
  private activeWalletProvider?: EvmWalletProvider;

  /**
   * Constructor for the PlaceholderActionProvider.
   */
  constructor() {
    super("placeholder", []);
    if (!process.env.PLACEHOLDER_CONTRACT_ADDRESS) {
      throw new Error("PLACEHOLDER_CONTRACT_ADDRESS not set in environment");
    }
    this.contractAddress = process.env.PLACEHOLDER_CONTRACT_ADDRESS;
    this.currentStrategy = strategies.aggressive;
    this.auctionState = {
      isActive: false,
      currentDisplay: 0,
      maxDisplays: 5,
      startPrice: BigInt(0),
      endPrice: BigInt(0),
      startTime: BigInt(0),
      duration: BigInt(0),
    };
  }

  /**
   * Places a bid in the auction for a specific token.
   *
   * @param walletProvider - The wallet provider to place the bid from.
   * @param args - The bid parameters including tokenId and bidAmount.
   * @returns A message containing the bid transaction details.
   */
  @CreateAction({
    name: "place_bid",
    description: `
    This tool will place a bid in the Placeholder Ads auction for a specific token using stable coin.
    
    It takes the following inputs:
    - tokenId: The ID of the token to bid on
    - bidAmount: The amount to bid in USD  values.
    
    The bid amount should be in USD  values.
    Example: To bid 100 stable coins, use "100".
    `,
    schema: PlaceBidSchema,
  })
  async placeBid(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PlaceBidSchema>,
  ): Promise<string> {
    try {
      // Parse amount with 18 decimals for stable coin
      const isActive = await this.getAuctionState();
      if (!isActive) {
        console.log("Auction is not active");
        return "Auction is not active";
      }
      const parsedAmount = parseUnits(args.bidAmount, 18);

      console.log("Placing bid for token", args.tokenId, "with stable coin amount", args.bidAmount);
      const txData = encodeFunctionData({
        abi,
        functionName: "placeBid",
        args: [BigInt(args.tokenId), parsedAmount],
      });

      const hash = await walletProvider.sendTransaction({
        to: this.contractAddress as Hex,
        data: txData as Hex,
        value: 0n,
      });

      await walletProvider.waitForTransactionReceipt(hash);
      // sleep for 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(
        `Bid placed successfully for token ${args.tokenId} with stable coin amount ${args.bidAmount}.\nTransaction hash: https://sepolia.basescan.org/tx/${hash}`,
      );

      return `Bid placed successfully for token ${args.tokenId} with ${args.bidAmount} USD.`;
    } catch (error) {
      return `Error placing bid: ${error}`;
    }
  }
  supportsNetwork = (_: Network) => true;

  /**
   * Returns the current price of the auction.
   *
   * @returns The current price of the auction in wei.
   */
  public async fetchCurrentPrice(): Promise<bigint> {
    const currentPrice = await this.getCurrentPrice();
    return currentPrice;
  }
  /**
   * Initializes the provider and starts monitoring events.
   *
   * @param walletProvider - The wallet provider to use for transactions
   */
  public async startMonitoring(walletProvider: EvmWalletProvider): Promise<void> {
    if (!process.env.WS_RPC_URL) {
      throw new Error("WS_RPC_URL environment variable is not set");
    }

    this.activeWalletProvider = walletProvider;
    this.wssProvider = new WebSocketProvider(process.env.WS_RPC_URL);
    this.httpProvider = new JsonRpcProvider(process.env.HTTP_RPC_URL);
    const contract = new ethers.Contract(this.contractAddress, abi, this.wssProvider);

    await this.setupEventListeners(contract);
    console.log("Started monitoring auction events");
  }
  /**
   * Sets up event listeners for the auction contract.
   *
   * @param contract - The ethers Contract instance
   */
  private async setupEventListeners(contract: ethers.Contract) {
    try {
      console.log("Setting up event listeners...");

      contract.on(
        "AuctionStarted",
        async (
          startPrice: bigint,
          endPrice: bigint,
          startTime: bigint,
          duration: bigint,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
          event: any,
        ) => {
          console.log("-----------------------------\n");
          console.log("Auction Started Event Received");
          console.log(`  Start Price: ${ethers.formatUnits(startPrice, 18)}`);
          console.log(`  End Price:   ${ethers.formatUnits(endPrice, 18)}`);
          console.log(`  Start Time:  ${new Date(Number(startTime) * 1000).toLocaleString()}`);
          console.log(`  Duration:    ${Number(duration)} seconds`);
          console.log("-----------------------------\n\n");

          this.auctionState = {
            ...this.auctionState,
            isActive: true,
            startPrice,
            endPrice,
            startTime,
            duration,
          };
          console.log("Auction state updated:", this.auctionState);

          await this.executeStrategy();
        },
      );
      // AuctionStarted event
      contract.on(
        "AuctionEnded",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
        (winner: string, winningBid: bigint, tokenId: bigint, event: any) => {
          console.log("------------🔚-----------------");
          console.log("Auction Ended Event Received");
          console.log(`  Winner:       ${winner}`);
          console.log(`  Winning Bid:  ${ethers.formatUnits(winningBid, 18)}`);
          console.log(`  Token ID:     ${tokenId.toString()}`);
          console.log("-----------------------------");
          this.auctionState.isActive = false;
          if (winner === "0xbb02a9D6A71A847D587cE4Dbb92F32f79c2EfB2a") {
            console.log("Auction won!");
            this.auctionState.currentDisplay++;
            console.log(
              `Updated display count: ${this.auctionState.currentDisplay}/${this.auctionState.maxDisplays}`,
            );
            this.evaluateAndUpdateStrategy(true);
          } else {
            console.log("Auction lost!");
            this.evaluateAndUpdateStrategy(false);
          }
        },
      );
      // AuctionEnded event

      console.log("Event listeners setup completed");
    } catch (error) {
      console.error("Error setting up event listeners:", error);
      throw error;
    }
  }

  /**
   * Executes the current bidding strategy.
   */
  private async executeStrategy() {
    if (
      !this.activeWalletProvider ||
      !this.auctionState.isActive ||
      this.auctionState.currentDisplay >= this.auctionState.maxDisplays
    ) {
      return;
    }

    const currentPrice = await this.getCurrentPrice();
    if (currentPrice === BigInt(0)) {
      return;
    }
    const bidAmount = await this.currentStrategy.calculateBid(currentPrice, this.auctionState);

    if (bidAmount > BigInt(0)) {
      await this.placeBid(this.activeWalletProvider, {
        tokenId: "5", // You'll need to determine the correct tokenId
        bidAmount: formatUnits(bidAmount, 18),
      });
    }
  }

  /**
   * Gets the current price from the auction contract.
   *
   * @returns The current price as a bigint
   */
  private async getCurrentPrice(): Promise<bigint> {
    try {
      if (!this.httpProvider) {
        throw new Error("Http Provider not initialized getCurrentPrice()");
      }
      const isActive = await this.getAuctionState();
      if (!isActive) {
        console.log("Auction is not active getCurrentPrice");
        return BigInt(0);
      }
      const contract = new ethers.Contract(this.contractAddress, abi, this.httpProvider);
      const price = await contract.getCurrentPrice();
      return BigInt(price.toString());
    } catch (error) {
      console.error("Error getting current price getCurrentPrice", error);
      return BigInt(0);
    }
  }

  /**
   * Retrieves the auction state from the smart contract and extracts the "isActive" boolean value.
   *
   * @returns {Promise<boolean>} A promise that resolves to the boolean indicating whether the auction is active.
   * @throws Will throw an error if the provider is not initialized or the contract call fails.
   */
  private async getAuctionState(): Promise<boolean> {
    try {
      if (!process.env.HTTP_RPC_URL) {
        throw new Error("WS_RPC_URL environment variable is not set");
      }

      if (!this.httpProvider) {
        throw new Error("Http Provider not initialized getAuctionState");
      }
      // Create a new contract instance using the ABI and provider
      const contract = new ethers.Contract(this.contractAddress, abi, this.wssProvider);

      // Call the getAuctionState function which returns [currentPrice, isActive, timeRemaining]
      const [, isActive] = await contract.getAuctionState();

      return isActive;
    } catch (error) {
      console.error("Error getting auction state: getAuctionState", error);
      return false;
    }
  }
  /**
   * Evaluates and updates the bidding strategy.
   *
   * @param wasSuccessful - Whether the last bid was successful
   */
  private evaluateAndUpdateStrategy(wasSuccessful: boolean) {
    if (wasSuccessful) {
      // If current strategy is working, stick with it
      return;
    }

    // Simple strategy rotation on failure
    const strategyNames = Object.keys(strategies);
    const currentIndex = strategyNames.indexOf(this.currentStrategy.name);
    const nextIndex = (currentIndex + 1) % strategyNames.length;
    this.currentStrategy = strategies[strategyNames[nextIndex]];
  }

  /**
   * Checks if the Placeholder action provider supports the given network.
   *
   * @param _ - The network to check.
   * @returns True if the Placeholder action provider supports the network, false otherwise.
   */
}

export const placeholderActionProvider = () => new PlaceholderActionProvider();
