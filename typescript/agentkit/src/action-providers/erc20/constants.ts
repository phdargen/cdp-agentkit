import { Coinbase } from "@coinbase/coinbase-sdk";

export const BaseTokenToAssetId = new Map([
  ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", Coinbase.assets.Cbbtc],
  ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", Coinbase.assets.Usdc],
  ["0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", Coinbase.assets.Eurc],
]);

export const BaseSepoliaTokenToAssetId = new Map([
  ["0xcbB7C0006F23900c38EB856149F799620fcb8A4a", Coinbase.assets.Cbbtc],
  ["0x036CbD53842c5426634e7929541eC2318f3dCF7e", Coinbase.assets.Usdc],
  ["0x808456652fdb597867f38412077A9182bf77359F", Coinbase.assets.Eurc],
]);

// Compact token symbol mappings using existing addresses only
export const TOKEN_SYMBOLS = {
  "base-mainnet": {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    EURC: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", 
    CBBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"
  },
  "base-sepolia": {
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    EURC: "0x808456652fdb597867f38412077A9182bf77359F",
    CBBTC: "0xcbB7C0006F23900c38EB856149F799620fcb8A4a"
  }
} as const;
