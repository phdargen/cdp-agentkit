import { z } from "zod";

/**
 * Input schema for resolving ENS name to address.
 */
export const GetEnsAddressSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe("The ENS name to resolve to an address (e.g., 'vitalik.eth')"),
  })
  .strip()
  .describe("Instructions for resolving an ENS name to an address");

/**
 * Input schema for reverse resolving address to ENS name.
 */
export const GetEnsNameSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The Ethereum address to resolve to an ENS name"),
  })
  .strip()
  .describe("Instructions for resolving an address to an ENS name");

/**
 * Input schema for getting ENS text records.
 */
export const GetEnsTextSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe("The ENS name to get text records for (e.g., 'vitalik.eth')"),
    key: z
      .string()
      .min(1)
      .describe(
        "The text record key to retrieve (e.g., 'description', 'url', 'avatar', 'com.twitter', 'com.github')",
      ),
  })
  .strip()
  .describe("Instructions for getting ENS text records");

/**
 * Input schema for getting ENS avatar.
 */
export const GetEnsAvatarSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe("The ENS name to get the avatar for (e.g., 'vitalik.eth')"),
  })
  .strip()
  .describe("Instructions for getting an ENS avatar URL");


