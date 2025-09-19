export interface ApiKeyResponse {
    success: boolean;
    apiKey: string;
    name: string;
    createdAt: string;
    message: string;
}
export interface PromptResponse {
    success: boolean;
    jobId: string;
    status: string;
    message: string;
    price?: {
        amount: string;
        asset: string;
    };
}
export interface SwapTransaction {
    type: "swap";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        approvalRequired?: boolean;
        approvalTx?: {
            to: string;
            data: string;
        };
        permit2?: {};
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface ApprovalTransaction {
    type: "approval";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface TransferErc20Transaction {
    type: "transfer_erc20";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface TransferEthTransaction {
    type: "transfer_eth";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface ConvertEthToWethTransaction {
    type: "convert_eth_to_weth";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface ConvertWethToEthTransaction {
    type: "convert_weth_to_eth";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface TransferNftTransaction {
    type: "transfer_nft";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface MintManifoldNftTransaction {
    type: "mint_manifold_nft";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface BuyNftTransaction {
    type: "buy_nft";
    metadata: {
        __ORIGINAL_TX_DATA__: {
            chain: string;
            humanReadableMessage: string;
            inputTokenAddress: string;
            inputTokenAmount: string;
            inputTokenTicker: string;
            outputTokenAddress: string;
            outputTokenTicker: string;
            receiver: string;
        };
        transaction: {
            chainId: number;
            to: string;
            data: string;
            gas: string;
            gasPrice: string;
            value: string;
        };
    };
}
export interface AvantisTradeTransaction {
    type: "avantisTrade";
    metadata: {
        chainId: number;
        description: string;
        to: string;
        data: string;
        value?: string;
    };
}
export interface SwapCrossChainTransaction {
    type: "swapCrossChain";
    metadata: {
        chainId: number;
        description: string;
        to: string;
        data: string;
        value: string;
    };
}
export type Transaction = SwapTransaction | ApprovalTransaction | TransferErc20Transaction | TransferEthTransaction | ConvertEthToWethTransaction | ConvertWethToEthTransaction | TransferNftTransaction | MintManifoldNftTransaction | BuyNftTransaction | AvantisTradeTransaction | SwapCrossChainTransaction;
export interface SocialCard {
    type: "social-card";
    variant: "analysis";
    text: string;
}
export interface Chart {
    type: "chart";
    url: string;
}
export type RichData = SocialCard | Chart;
export interface JobStatus {
    success: boolean;
    jobId: string;
    status: "pending" | "processing" | "completed" | "failed" | "cancelled";
    prompt: string;
    createdAt: string;
    processingTime?: number;
    response?: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    transactions?: Transaction[];
    richData?: RichData[];
    cancellable?: boolean;
}
export interface X402ErrorResponse {
    x402Version: number;
    error: string;
    accepts: any[];
}
export interface BankrClientConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    walletAddress?: string;
    privateKey: `0x${string}`;
    network?: "base";
}
export interface PromptOptions {
    prompt: string;
    walletAddress?: string;
    xmtp?: boolean;
}
export interface PollOptions {
    jobId: string;
    interval?: number;
    maxAttempts?: number;
    timeout?: number;
}
export interface ApprovalOptions {
    spenderAddress: string;
    amount?: bigint;
}
export interface AllowanceResponse {
    allowance: bigint;
    spenderAddress: string;
    ownerAddress: string;
}
