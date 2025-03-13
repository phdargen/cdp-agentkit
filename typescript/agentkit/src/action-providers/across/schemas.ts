import { z } from "zod";

/**
 * Input schema for bridge token action.
 */
export const BridgeTokenSchema = z
  .object({
    destinationChainId: z.number().describe("The chain ID of the destination chain"),
    inputToken: z.string().describe("The address of the token to bridge from the origin chain").default("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"),
    outputToken: z.string().describe("The address of the token to receive on the destination chain").default("0x4200000000000000000000000000000000000006"),
    amount: z.string().describe("The amount of tokens to bridge (in token's smallest unit)"),
    recipient: z.string().optional().describe("The recipient address on the destination chain (defaults to sender)"),
  })
  .strip()
  .describe("Instructions for bridging tokens across chains using Across Protocol"); 