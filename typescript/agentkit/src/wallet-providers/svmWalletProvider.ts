/* eslint-disable @typescript-eslint/no-explicit-any */

import { WalletProvider } from "./walletProvider";
import {
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureStatus,
  SignatureStatusConfig,
  VersionedTransaction,
  SignatureResult,
} from "@solana/web3.js";
import { 
  isKeyPairSigner, 
  KeyPairSigner,
} from "@solana/kit";
import type { 
  Address,
  TransactionMessageBytes,
  SignaturesMap,
  BaseTransactionSignerConfig,
  SignatureBytes,
  MessagePartialSignerConfig
} from "@solana/kit";

/**
 * SvmWalletProvider is the abstract base class for all Solana wallet providers (non browsers).
 *
 * @abstract
 */
export abstract class SvmWalletProvider extends WalletProvider {
  /**
   * Get the connection instance.
   *
   * @returns The Solana connection instance.
   */
  abstract getConnection(): Connection;

  /**
   * Get the public key of the wallet.
   *
   * @returns The wallet's public key.
   */
  abstract getPublicKey(): PublicKey;

  /**
   * Sign a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  abstract signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction>;

  /**
   * Send a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The signature.
   */
  abstract sendTransaction(transaction: VersionedTransaction): Promise<string>;

  /**
   * Sign and send a transaction.
   *
   * @param transaction - The transaction to sign and send.
   * @returns The signature.
   */
  abstract signAndSendTransaction(transaction: VersionedTransaction): Promise<string>;

  /**
   * Get the status of a transaction.
   *
   * @param signature - The signature.
   * @returns The status.
   */
  abstract getSignatureStatus(
    signature: string,
    options?: SignatureStatusConfig,
  ): Promise<RpcResponseAndContext<SignatureStatus | null>>;

  /**
   * Wait for signature receipt.
   *
   * @param signature - The signature
   * @returns The confirmation response
   */
  abstract waitForSignatureResult(
    signature: string,
  ): Promise<RpcResponseAndContext<SignatureResult>>;

  /**
   * Sign a message.
   *
   * @param message - The message to sign as a Uint8Array
   * @returns The signature as a Uint8Array
   */
  abstract signMessage(message: Uint8Array): Promise<Uint8Array>;


  /**
   * Convert the wallet provider to a Signer compatible with x402.
   *
   * @returns The signer instance
   */
  toSigner(): KeyPairSigner {
    const self = this;

    return {
      address: self.getAddress() as Address,

      keyPair: self.getKeyPair(),  

      signTransactions: async (
        txs: readonly Readonly<{
          messageBytes: TransactionMessageBytes;
          signatures: SignaturesMap;
        }>[],
        _config?: BaseTransactionSignerConfig
      ) => {
        const out: { messageBytes: TransactionMessageBytes; signatures: SignaturesMap; }[] = [];
        for (const { messageBytes, signatures } of txs) {
          const sig = await self.signMessage(new Uint8Array(messageBytes));
          const addr = self.getAddress() as Address;
          out.push({ messageBytes, signatures: { ...signatures, [addr]: sig as SignatureBytes } });
        }
        return out;
      },

      signMessages: async (
        msgs: readonly Readonly<{
          content: Uint8Array<ArrayBufferLike>;
          signatures: Readonly<Record<Address, SignatureBytes>>;
        }>[],
        _config?: Readonly<MessagePartialSignerConfig>
      ) => {
        const out: {
          content: Uint8Array<ArrayBufferLike>;
          signatures: Readonly<Record<Address, SignatureBytes>>;
        }[] = [];
        for (const { content, signatures } of msgs) {
          const sig = await self.signMessage(new Uint8Array(content));
          const addr = self.getAddress() as Address;
          out.push({ content, signatures: { ...signatures, [addr]: sig as SignatureBytes } });
        }
        return out;
      },
    };
  }
  
  /**
   * Get the keypair for this wallet.
   *
   * @returns The CryptoKeyPair for KeyPairSigner compatibility
   */
  abstract getKeyPair(): any;

  /**
   * Check if this wallet's signer is a valid KeyPairSigner for x402 compatibility.
   *
   * @returns True if the signer is a valid KeyPairSigner, false otherwise
   */
  isKeyPairSigner(): boolean {
    try {
      const signer = this.toSigner();
      return isKeyPairSigner(signer);
    } catch (error) {
      console.warn("Error checking KeyPairSigner compatibility:", error);
      return false;
    }
  }
}
