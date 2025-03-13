import { mainnet, optimism, arbitrum, base, polygon, sepolia, baseSepolia } from "viem/chains";

/**
 * Supported chains for Across Protocol
 */
export const SUPPORTED_CHAINS = [
  mainnet,
  optimism,
  arbitrum,
  base,
  polygon,
  sepolia,
  baseSepolia,
];

/**
 * Integrator ID for AgentKit
 */
export const INTEGRATOR_ID = "0x4147"; // "AG" in hex for AgentKit 