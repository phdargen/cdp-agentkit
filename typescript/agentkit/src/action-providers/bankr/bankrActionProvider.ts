import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import axios, { AxiosInstance, AxiosError } from "axios";
import { decodeXPaymentResponse, withPaymentInterceptor } from "x402-axios";
import { Hex, encodeFunctionData, erc20Abi, maxUint256, parseUnits } from "viem";
import { BNKR_TOKEN_ADDRESS, BNKR_FACILITATOR_ADDRESS, BASE_URL } from "./constants";
import { PromptSchema, GetJobStatusSchema } from "./schemas";
import { handleBankrHttpError, getTokenDetails, getAllowance } from "./utils";
import type { JobStatus, PromptResponse } from "./types";

/**
 * Configuration options for the BankrActionProvider.
 */
export interface BankrActionProviderConfig {
  /**
   * Bankr API Key.
   */
  apiKey?: string;
  /**
   * The base URL for the Bankr API.
   */
  baseUrl?: string;
}

/**
 * BankrActionProvider provides actions for interacting with the Bankr Agent.
 */
export class BankrActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly axiosInstance: AxiosInstance;

  /**
   * Constructor for the BankrActionProvider.
   * @param config - The configuration options for the BankrActionProvider.
   */
  constructor(config: BankrActionProviderConfig = {}) {
    super("bankr", []);

    this.apiKey = config.apiKey || process.env.BANKR_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("BANKR_API_KEY is not configured.");
    }
    this.baseUrl = config.baseUrl || BASE_URL;

    // Initialize basic axios instance for non-payment calls
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      responseType: "json",
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Fetches the price for a prompt without making a payment.
   * This method expects a 402 status code with price information in the accepts field.
   *
   * @param args - The input arguments for the prompt.
   * @returns The price information from the API.
   */
  private async fetchPromptPrice(args: z.infer<typeof PromptSchema>): Promise<{ amount: string; asset: string }> {
    const requestBody: { prompt: string; walletAddress?: string; xmtp?: boolean } = {
      prompt: args.prompt,
      xmtp: args.xmtp,
    };

    try {
      const response = await this.axiosInstance.post("/prompt", requestBody);
      
      // If we get here, it means the request succeeded without payment, which is unexpected
      // The API should return 402 for price information
      throw new Error("Unexpected successful response - expected 402 status for price fetch");
    } catch (error) {
      // Check if this is an AxiosError with 402 status (expected)
      if (error instanceof AxiosError && error.response?.status === 402) {
        const responseData = error.response.data;
        
        console.log("402 response data:", responseData);
        console.log("accepts field:", responseData.accepts);

        // Extract price information from the accepts field
        if (responseData.accepts && Array.isArray(responseData.accepts) && responseData.accepts.length > 0) {
          const acceptInfo = responseData.accepts[0];
          
          // The accepts field should contain the price information
          if (acceptInfo.maxAmountRequired && acceptInfo.asset) {
            return {
              amount: acceptInfo.maxAmountRequired,
              asset: acceptInfo.asset
            };
          }
        }
        
        throw new Error("Price information not found in 402 response accepts field");
      }
      
      // For any other error (not 402), re-throw it
      console.error("Error fetching prompt price:", error);
      throw new Error(`Failed to fetch prompt price: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sends a prompt to the Bankr API with automatic balance/allowance checking and approval.
   *
   * @param walletProvider - The wallet provider to use for potential payments.
   * @param args - The input arguments for the prompt action.
   * @returns A JSON string containing the final job result or error details.
   */
  @CreateAction({
    name: "prompt_bankr",
    description: `
    This action is used to delegate a prompt/task to the Bankr Agent via x402 API.
    Capabilities of the Bankr Agent include:
        - Get real-time social sentiment analysis for any token or project
        - Technical analysis for tokens
        - Buy and send tokens
        - ETH <-> WETH conversion
        - NFT mints/transfers/buys
        - Swap tokens
    IMPORTANT:
    - This action will be pay the Bankr Agent via x402.
    - It should only be called when the user explicitly requests to interact with the Bankr Agent, 
    for example: "Ask/tell or chat with Bankr ...".
     
    It takes the following inputs:
    - prompt: The natural language prompt to send to the Bankr Agent.
    - xmtp: (Optional) A boolean indicating if the prompt is from XMTP.
    - interval: (Optional) The polling interval in milliseconds (default: 2000 = 2 seconds).
    - maxAttempts: (Optional) The maximum number of polling attempts (default: 150).
    - timeout: (Optional) The maximum time to poll in milliseconds (default: 300000 = 5 minutes).
    `,
    schema: PromptSchema,
  })
  async prompt(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PromptSchema>,
  ): Promise<string> {
    try {
      const walletAddress = walletProvider.getAddress();
      
      // First, fetch the required price from the API
      let priceInfo: { amount: string; asset: string };
      try {
        priceInfo = await this.fetchPromptPrice(args);
        console.log("priceInfo", priceInfo);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: "Failed to fetch prompt price",
          details: error instanceof Error ? error.message : String(error),
        });
      }

      // Check BNKR token balance
      const tokenDetails = await getTokenDetails(walletProvider, BNKR_TOKEN_ADDRESS, walletAddress);
      if (!tokenDetails) {
        return JSON.stringify({
          success: false,
          error: "Could not fetch BNKR token details. Please verify the wallet is on a supported network.",
        });
      }

      // Use the fetched price amount for allowance check
      const requiredAmount = BigInt(priceInfo.amount);
      const currentAllowance = await getAllowance(
        walletProvider,
        BNKR_TOKEN_ADDRESS,
        walletAddress,
        BNKR_FACILITATOR_ADDRESS
    );

      if (currentAllowance === null) {
        return JSON.stringify({
          success: false,
          error: "Could not check BNKR allowance.",
        });
      }

      // Approve if allowance is insufficient
      let approvalTxHash: string | null = null;
      if (currentAllowance < requiredAmount) {
        try {
          const approvalData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [BNKR_FACILITATOR_ADDRESS as Hex, maxUint256], 
          });

          approvalTxHash = await walletProvider.sendTransaction({
            to: BNKR_TOKEN_ADDRESS as Hex,
            data: approvalData,
          });

          await walletProvider.waitForTransactionReceipt(approvalTxHash as Hex);
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: "Failed to approve BNKR spending",
            details: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Send prompt to Bankr API
      const requestBody: { prompt: string; walletAddress?: string; xmtp?: boolean } = {
        prompt: args.prompt,
        xmtp: args.xmtp,
        walletAddress,
      };

      // Create axios instance with payment interceptor for the prompt call
      const axiosWithPayment = withPaymentInterceptor(
        this.axiosInstance,
        walletProvider.toSigner() as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      );

      let promptResponse: PromptResponse;
      let paymentProof;
      try {
        const response = await axiosWithPayment.post("/prompt", requestBody);
        console.log("response", response);
        
        // Ensure response.data is properly parsed
        if (typeof response.data === 'string') {
          try {
            promptResponse = JSON.parse(response.data);
          } catch (parseError) {
            console.error("Failed to parse response data:", response.data);
            return JSON.stringify({
              success: false,
              error: "Invalid response format",
              details: "Failed to parse API response",
            });
          }
        } else {
          promptResponse = response.data;
        }

        // Check for payment proof
        try {
          const paymentResponseHeader = response.headers["x-payment-response"];
          if (paymentResponseHeader && typeof paymentResponseHeader === 'string') {
            console.log("Raw payment response header:", paymentResponseHeader);
            
            // Check if it's already a JSON string (not base64)
            if (paymentResponseHeader.startsWith('{') && paymentResponseHeader.endsWith('}')) {
              try {
                paymentProof = JSON.parse(paymentResponseHeader);
                console.log("Successfully parsed JSON payment proof");
              } catch (jsonError) {
                console.warn("Failed to parse JSON payment response:", jsonError);
                paymentProof = null;
              }
            } else {
              // Try to decode as base64
              const cleanedHeader = paymentResponseHeader.trim().replace(/\s/g, '');
              const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
              
              if (base64Regex.test(cleanedHeader) && cleanedHeader.length > 0) {
                try {
                  paymentProof = decodeXPaymentResponse(cleanedHeader);
                  console.log("Successfully decoded base64 payment proof");
                } catch (decodeError) {
                  console.warn("Failed to decode base64 payment response:", decodeError);
                  paymentProof = null;
                }
              } else {
                console.warn("Invalid format in x-payment-response header (first 50 chars):", cleanedHeader.substring(0, 50));
                paymentProof = null;
              }
            }
          } else {
            console.log("No payment response header found");
            paymentProof = null;
          }
        } catch (paymentError) {
          console.error("Failed to process payment response:", paymentError);
          paymentProof = null;
        }
      } catch (error) {
        console.error("Error in prompt API call:", error);
        return handleBankrHttpError(error as AxiosError, "/prompt");
      }

      if (!promptResponse.success || !promptResponse.jobId) {
        return JSON.stringify({
          success: false,
          error: "Failed to submit prompt",
          details: promptResponse.message || "Unknown error",
        });
      }

      // Poll for job completion
      const { interval = 2000, maxAttempts = 150, timeout = 300000 } = args;
      const startTime = Date.now();
      let attempts = 0;

      while (attempts < maxAttempts) {
        if (Date.now() - startTime > timeout) {
          return JSON.stringify({
            success: false,
            error: "Polling timeout exceeded",
            details: `Job ${promptResponse.jobId} did not complete within ${timeout}ms`,
            jobId: promptResponse.jobId,
          });
        }

        try {
          const statusResponse = await this.axiosInstance.get(`/job/${promptResponse.jobId}`);
          const jobStatus: JobStatus = statusResponse.data;

          if (jobStatus.status === "completed") {
            return JSON.stringify({
              success: true,
              jobId: promptResponse.jobId,
              status: jobStatus.status,
              response: jobStatus.response,
              transactions: jobStatus.transactions,
              richData: jobStatus.richData,
              processingTime: jobStatus.processingTime,
              ...(approvalTxHash && { approvalTxHash }),
              message: "Prompt completed successfully",
              paymentProof: paymentProof
                ? {
                    transaction: paymentProof.transaction,
                    network: paymentProof.network,
                    payer: paymentProof.payer,
                  }
                : null,
            });
          }

          if (jobStatus.status === "failed") {
            return JSON.stringify({
              success: false,
              jobId: promptResponse.jobId,
              status: jobStatus.status,
              error: jobStatus.error || "Job failed",
              ...(approvalTxHash && { approvalTxHash }),
              paymentProof: paymentProof
                ? {
                    transaction: paymentProof.transaction,
                    network: paymentProof.network,
                    payer: paymentProof.payer,
                  }
                : null,
            });
          }

          // Job is still processing, continue polling
          await new Promise((resolve) => setTimeout(resolve, interval));
          attempts++;
        } catch (error) {
          return handleBankrHttpError(error as AxiosError, `/job/${promptResponse.jobId}`);
        }
      }

      return JSON.stringify({
        success: false,
        error: "Maximum polling attempts exceeded",
        details: `Job ${promptResponse.jobId} did not complete after ${maxAttempts} attempts`,
        jobId: promptResponse.jobId,
        ...(approvalTxHash && { approvalTxHash }),
        paymentProof: paymentProof
          ? {
              transaction: paymentProof.transaction,
              network: paymentProof.network,
              payer: paymentProof.payer,
            }
          : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: "Unexpected error in prompt action",
        details: message,
      });
    }
  }

  /**
   * Gets the status of a Bankr job with polling until completion.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The input arguments for the get job status action.
   * @returns A JSON string containing the final job status or error details.
   */
  @CreateAction({
    name: "get_job_status",
    description: `
    Gets the status of a job previously submitted to the Bankr Agent and polls until completion or failure.
    It takes the following inputs:
    - jobId: The ID of the job to check the status for.
    - interval: (Optional) The polling interval in milliseconds (default: 2000).
    - maxAttempts: (Optional) The maximum number of polling attempts (default: 150).
    - timeout: (Optional) The maximum time to poll in milliseconds (default: 300000).
    `,
    schema: GetJobStatusSchema,
  })
  async getJobStatus(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetJobStatusSchema>,
  ): Promise<string> {
    try {
      const { jobId, interval = 2000, maxAttempts = 150, timeout = 300000 } = args;
      const startTime = Date.now();
      let attempts = 0;

      while (attempts < maxAttempts) {
        if (Date.now() - startTime > timeout) {
          return JSON.stringify({
            success: false,
            error: "Polling timeout exceeded",
            details: `Job ${jobId} status polling timed out after ${timeout}ms`,
            jobId,
          });
        }

        try {
          const response = await this.axiosInstance.get(`/job/${jobId}`);
          const jobStatus: JobStatus = response.data;

          if (jobStatus.status === "completed" || jobStatus.status === "failed") {
            return JSON.stringify({
              success: jobStatus.status === "completed",
              jobId,
              status: jobStatus.status,
              response: jobStatus.response,
              error: jobStatus.error,
              transactions: jobStatus.transactions,
              richData: jobStatus.richData,
              processingTime: jobStatus.processingTime,
              message: `Job ${jobStatus.status} successfully`,
            });
          }

          // Job is still processing, continue polling
          await new Promise((resolve) => setTimeout(resolve, interval));
          attempts++;
        } catch (error) {
          return handleBankrHttpError(error as AxiosError, `/job/${jobId}`);
        }
      }

      return JSON.stringify({
        success: false,
        error: "Maximum polling attempts exceeded",
        details: `Job ${jobId} status did not reach completion after ${maxAttempts} attempts`,
        jobId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: "Unexpected error in get job status action",
        details: message,
        jobId: args.jobId,
      });
    }
  }

  /**
   * Checks if the Bankr action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Bankr action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const bankrActionProvider = (config?: BankrActionProviderConfig) =>
  new BankrActionProvider(config);
