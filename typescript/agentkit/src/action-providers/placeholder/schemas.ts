// schemas.ts
import { z } from "zod";

/**
 * Input schema for place bid action.
 */
export const PlaceBidSchema = z
  .object({
    tokenId: z.string().describe("The NFT token ID to bid on"),
    bidAmount: z.string().describe("The amount to bid in stable coin (18 decimals)"),
  })
  .strip()
  .describe("Instructions for placing a bid in the auction using stable coin");
