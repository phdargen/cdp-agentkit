export interface AuctionState {
  isActive: boolean;
  currentDisplay: number;
  maxDisplays: number;
  startPrice: bigint;
  endPrice: bigint;
  startTime: bigint;
  duration: bigint;
  lastSuccessfulBid: number;
  lastFailedBid: number;
  lastAuctionStatus: string;
  needsStrategyUpdate: boolean;
  lastStrategySuccess: boolean;
}

export interface BiddingStrategy {
  name: string;
  calculateBid: (currentPrice: bigint, state: AuctionState) => Promise<bigint>;
}
