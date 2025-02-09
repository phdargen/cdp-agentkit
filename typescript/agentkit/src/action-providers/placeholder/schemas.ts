// schemas.ts
import { z } from "zod";

/**
 * Input schema for place bid action.
 */
export const PlaceBidSchema = z
  .object({
    tokenId: z.string().describe("The NFT token ID to bid on"),
    bidAmount: z.string().describe("The amount to bid in USD"),
  })
  .strip()
  .describe("Instructions for placing a bid in the auction using USD coin");
export const SelectStrategySchema = z.object({
  strategy: z
    .enum(["aggressive", "patient", "conservative"])
    .describe("The strategy to select: aggressive, patient, or conservative"),
  reason: z.string().describe("Explanation for why this strategy was chosen"),
});

export const SelectPriceSchema = z.object({
  suggestedPrice: z.string().describe("Suggested bid price in USD "),
  reason: z.string().describe("Explanation for the price selection"),
});
