import { z } from "zod";

/**
 * Input schema for prompt action.
 */
export const PromptSchema = z
  .object({
    prompt: z.string().min(1).describe("The natural language prompt to send to the Bankr Agent"),
    xmtp: z.boolean().default(false).describe("A boolean indicating if the prompt is from XMTP (default: false)"),
    interval: z
      .number()
      .int()
      .min(1000)
      .optional()
      .default(2000)
      .describe("The polling interval in milliseconds (default: 2000)"),
    maxAttempts: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(150)
      .describe("The maximum number of polling attempts (default: 150)"),
    timeout: z
      .number()
      .int()
      .min(5000)
      .optional()
      .default(300000)
      .describe("The maximum time to poll in milliseconds (default: 300000)"),
  })
  .strip()
  .describe("Instructions for sending a prompt to the Bankr Agent");

/**
 * Input schema for get job status action.
 */
export const GetJobStatusSchema = z
  .object({
    jobId: z.string().min(1).describe("The ID of the job to check the status for"),
    interval: z
      .number()
      .int()
      .min(1000)
      .optional()
      .default(2000)
      .describe("The polling interval in milliseconds (default: 2000)"),
    maxAttempts: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(150)
      .describe("The maximum number of polling attempts (default: 150)"),
    timeout: z
      .number()
      .int()
      .min(5000)
      .optional()
      .default(300000)
      .describe("The maximum time to poll in milliseconds (default: 300000)"),
  })
  .strip()
  .describe("Instructions for getting a job status with polling");