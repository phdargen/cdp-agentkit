export interface AuctionState {
  isActive: boolean;
  startPrice: bigint;
  endPrice: bigint;
  startTime: bigint;
  duration: bigint;
  currentDisplay: number;
  maxDisplays: number;
  needsStrategyUpdate: boolean;
  lastStrategySuccess: boolean;
  currentPrice?: bigint;
  marketConditions?: {
    priceRange: bigint;
    timeRemaining: bigint;
    priceDropRate: bigint;
  };
  lastAuctionResult?: {
    winner: string;
    winningBid: bigint;
    wasWinner: boolean;
    tokenId: bigint;
  };
  strategyMetrics?: {
    successRate: number;
    averageBidPrice: bigint;
    displayProgress: {
      acquired: number;
      remaining: number;
    };
  };
  bidHistory?: bigint[];
  totalAuctions?: number;
}

export interface BiddingStrategy {
  name: string;
  calculateBid: (currentPrice: bigint, state: AuctionState) => Promise<bigint>;
}
