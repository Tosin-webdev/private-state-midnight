// src/witnesses.ts

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "../contracts/managed/score/contract/index.js";
import type { ScorePrivateState } from "./types.js";

type ScoreWitnessContext = WitnessContext<Ledger, ScorePrivateState>;

export const witnesses = {
  /**
   * Returns the secret key to the circuit.
   * TypeScript: Uint8Array → Compact: Bytes<32>
   * Private state is unchanged.
   */
  localSecretKey: ({
    privateState,
  }: ScoreWitnessContext): [ScorePrivateState, Uint8Array] => {
    if (privateState.secretKey.length !== 32) {
      throw new Error("Corrupted private state: secretKey must be 32 bytes.");
    }
    return [privateState, privateState.secretKey];
  },

  /**
   * Returns the current score to the circuit.
   * TypeScript: bigint → Compact: Uint<64>
   * Private state is unchanged.
   */
  localScore: ({
    privateState,
  }: ScoreWitnessContext): [ScorePrivateState, bigint] => {
    return [privateState, privateState.score];
  },
};
