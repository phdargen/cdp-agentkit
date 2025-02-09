import { BiddingStrategy, AuctionState } from "./types";
import { PlaceholderActionProvider } from "./placeholderActionProvider";
import { ethers } from "ethers";

export const strategies: Record<string, BiddingStrategy> = {
  aggressive: {
    name: "aggressive",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    calculateBid: async (currentPrice: bigint, _state: AuctionState): Promise<bigint> => {
      return currentPrice;
    },
  },

  patient: {
    name: "patient",
    calculateBid: async (currentPrice: bigint, state: AuctionState): Promise<bigint> => {
      try {
        const placeholderActionProvider = new PlaceholderActionProvider();
        await placeholderActionProvider.getAuctionDetails();

        // Explicit conversion to BigInt for safety
        const startPrice = BigInt(state.startPrice);
        const endPrice = BigInt(state.endPrice);
        const fiftyPercent = BigInt(50);
        const hundredPercent = BigInt(100);

        const priceRange = startPrice - endPrice;
        const priceDropAmount = (priceRange * fiftyPercent) / hundredPercent;
        const targetPrice = endPrice + priceDropAmount;
        return new Promise((resolve, reject) => {
          // Function to check price
          const checkPrice = async () => {
            try {
              const currentPrice = await placeholderActionProvider.fetchCurrentPrice();
              // eslint-disable-next-line multiline-comment-style
              // console.log(
              //   `Current price: ${currentPrice}, Target price: ${ethers.formatUnits(targetPrice, 18)}`,
              // );

              if (currentPrice <= targetPrice) {
                console.log("Target price reached!");
                resolve(currentPrice);
              } else {
                // Check again in 1 second
                setTimeout(checkPrice, 1000);
              }
            } catch (error) {
              console.error("Error fetching price:", error);
              reject(error);
            }
          };

          // Start checking
          checkPrice();
        });
      } catch (error) {
        console.error("Error in patient strategy calculation:", error);
        return BigInt(0);
      }
    },
  },

  conservative: {
    name: "conservative",
    calculateBid: async (currentPrice: bigint, state: AuctionState): Promise<bigint> => {
      try {
        const placeholderActionProvider = new PlaceholderActionProvider();
        await placeholderActionProvider.getAuctionDetails();
        const startPrice = BigInt(state.startPrice);
        const endPrice = BigInt(state.endPrice);
        const twentyPercent = BigInt(20);
        const hundredPercent = BigInt(100);

        const priceRange = startPrice - endPrice;
        const priceDropAmount = (priceRange * twentyPercent) / hundredPercent;
        const targetPrice = endPrice + priceDropAmount;

        return new Promise((resolve, reject) => {
          // Function to check price
          const checkPrice = async () => {
            try {
              const currentPrice = await placeholderActionProvider.fetchCurrentPrice();
              console.log(
                `Current price: ${currentPrice}, Target price: ${ethers.formatUnits(targetPrice, 18)}`,
              );

              if (currentPrice <= targetPrice) {
                console.log("Target price reached!");
                resolve(currentPrice);
              } else {
                // Check again in 1 second
                setTimeout(checkPrice, 1000);
              }
            } catch (error) {
              console.error("Error fetching price:", error);
              reject(error);
            }
          };

          // Start checking
          checkPrice();
        });
      } catch (error) {
        console.error("Error in conservative strategy calculation:", error);
        return BigInt(0);
      }
    },
  },
};
