import { z } from "zod";

/**
 * Input schema for get active markets action.
 */
export const GetActiveTruthMarketsSchema = z
  .object({
    limit: z.number().optional().describe("Maximum number of markets to return (default: 10)"),
    offset: z.number().optional().describe("Number of markets to skip (for pagination)"),
    sortOrder: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort order for the markets (default: desc)"),
  })
  .strip()
  .describe("Instructions for getting active markets on Truemarkets");

/**
 * Input schema for get market details action.
 */
export const GetMarketDetailsSchema = z
  .object({
    marketAddress: z.string().describe("Address of the market to retrieve details for"),
  })
  .strip()
  .describe("Instructions for getting detailed information about a specific market on Truemarkets");
