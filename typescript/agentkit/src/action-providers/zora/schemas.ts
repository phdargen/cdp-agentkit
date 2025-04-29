import { z } from "zod";

export const CreateCoinSchema = z
  .object({
    name: z.string().describe("The name of the coin to create"),
    symbol: z.string().describe("The symbol of the coin to create"),
    description: z.string().describe("The description of the coin"),
    imageFileName: z.string().describe("The name of the image file to upload to IPFS"),
    payoutRecipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("The address that will receive creator earnings, defaults to wallet address"),
    platformReferrer: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("The address that will receive platform referrer fees, optional"),
    initialPurchase: z
      .string()
      .optional()
      .describe(
        "The initial purchase amount in whole units of ETH (e.g. 1.5 for 1.5 ETH), defaults to 0",
      ),
  })
  .strip()
  .describe("Instructions for creating a new coin on Zora");
