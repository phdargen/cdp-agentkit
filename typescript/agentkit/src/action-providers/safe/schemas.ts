import { z } from "zod";

export const SafeInfoSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the existing Safe to connect to"),
});

export const AddSignerSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe to modify"),
  newSigner: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the new signer to add"),
  newThreshold: z.number().optional().describe("Optional new threshold after adding signer"),
});

export const RemoveSignerSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe to modify"),
  signerToRemove: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the signer to remove"),
  newThreshold: z.number().optional().describe("Optional new threshold after removing signer"),
});

export const ChangeThresholdSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe to modify"),
  newThreshold: z.number().min(1).describe("New threshold value"),
});

export const ApprovePendingTransactionSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  safeTxHash: z.string().describe("Transaction hash to approve/execute"),
  executeImmediately: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to execute the transaction immediately if all signatures are collected"),
});

export const EnableAllowanceModuleSchema = z.object({});

export const SetAllowanceSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  delegateAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the delegate who will receive the allowance"),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .optional()
    .describe("Address of the ERC20 token (defaults to Sepolia WETH)")
    .default("0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"),
  amount: z.string().describe("Amount of tokens to allow (e.g. '1.5' for 1.5 tokens)"),
  resetTimeInMinutes: z
    .number()
    .optional()
    .describe(
      "One time allowance by default. If larger than zero, time in minutes after which the allowance resets",
    )
    .default(0),
});

export const GetAllowanceInfoSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  delegateAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the delegate to check allowance for"),
});

export const WithdrawAllowanceSchema = z.object({
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the Safe"),
  delegateAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the delegate to withdraw allowance for"),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
    .describe("Address of the ERC20 token"),
  amount: z
    .string()
    .describe("Amount of tokens to withdraw in whole units (e.g. 1.5 WETH, 10 USDC)"),
});
