// src/wallet.ts

import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
} from "@midnight-ntwrk/ledger-v8";
import {
  type MidnightProvider,
  type UnboundTransaction,
  type WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from "@midnight-ntwrk/testkit-js";
import { type WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { firstValueFrom } from "rxjs";

// Re-export so api.ts and index.ts can import EnvironmentConfiguration from one place.
export type { EnvironmentConfiguration };

// Minimal type for the unshielded keystore returned by FluentWalletBuilder.
// The builder's return type is not fully exported, so we cast with `as unknown`.
type Keystore = {
  signData(payload: Uint8Array): string;
};

export class ScoreWalletProvider implements WalletProvider, MidnightProvider {
  private constructor(
    private readonly wallet: WalletFacade,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    private readonly keystore: Keystore
  ) {}

  // ── WalletProvider ──────────────────────────────────────────────────────────

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  // Balances a raw transaction (adds dust inputs/outputs), signs it, and finalises it.
  async balanceTx(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour()
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl }
    );
    const signedRecipe = await this.wallet.signRecipe(recipe, (payload) =>
      this.keystore.signData(payload)
    );
    return this.wallet.finalizeRecipe(signedRecipe);
  }

  // ── MidnightProvider ────────────────────────────────────────────────────────

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  /**
   * Builds the wallet from a seed string, starts syncing, and returns:
   *   provider — implements both WalletProvider and MidnightProvider
   *   address  — the coin public key string, ready to display or fund
   */
  static async build(
    config: EnvironmentConfiguration,
    seed: string
  ): Promise<{ provider: ScoreWalletProvider; address: string }> {
    // additionalFeeOverhead compensates for the local devnet's non-standard fee model.
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead:
        config.walletNetworkId === "undeployed"
          ? 500_000_000_000_000_000n
          : 1_000n,
      feeBlocksMargin: 5,
    };

    const buildResult = await FluentWalletBuilder.forEnvironment(config)
      .withDustOptions(dustOptions)
      .withSeed(seed)
      .buildWithoutStarting();

    // The builder's return type is opaque; cast to extract what we need.
    const { wallet, seeds, keystore } = buildResult as unknown as {
      wallet: WalletFacade;
      seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
      keystore: Keystore;
    };

    const zswapSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
    const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);

    // Read the wallet address before starting — avoids a race with the sync loop.
    const shieldedState = await firstValueFrom(wallet.shielded.state);
    const address = shieldedState.address.coinPublicKeyString();

    await wallet.start(zswapSecretKeys, dustSecretKey);

    return {
      provider: new ScoreWalletProvider(
        wallet,
        zswapSecretKeys,
        dustSecretKey,
        keystore
      ),
      address,
    };
  }
}
