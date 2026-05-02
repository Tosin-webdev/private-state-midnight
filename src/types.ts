// src/types.ts

export type ScorePrivateState = {
  readonly secretKey: Uint8Array; // Compact: Bytes<32>
  readonly score: bigint; // Compact: Uint<64>
};

/**
 * Factory function — the single place where fresh private state is created.
 * Default score is 0. Always generate a new secretKey with secure randomness.
 */
export const createScorePrivateState = (
  secretKey: Uint8Array,
  score: bigint = 0n
): ScorePrivateState => ({ secretKey, score });

/**
 * Serializer — converts private state to a plain JSON-safe object.
 * Uint8Array → number[] and bigint → string to survive JSON round-trip.
 * Used for backup files and schema migration; NOT needed for levelPrivateStateProvider.
 */
export function serializeScorePrivateState(state: ScorePrivateState): object {
  return {
    secretKey: Array.from(state.secretKey),
    score: state.score.toString(),
  };
}

/**
 * Deserializer — restores private state from a serialized object.
 * Must be the exact inverse of serializeScorePrivateState.
 */
export function deserializeScorePrivateState(raw: unknown): ScorePrivateState {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid serialized state: expected an object.");
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.secretKey) || obj.secretKey.length !== 32) {
    throw new Error(
      "Invalid serialized state: secretKey must be an array of 32 numbers."
    );
  }
  const bytes = obj.secretKey as unknown[];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (typeof b !== "number" || !Number.isInteger(b) || b < 0 || b > 255) {
      throw new Error(
        `Invalid serialized state: secretKey[${i}] is not a byte value (0-255).`
      );
    }
  }
  if (typeof obj.score !== "string" || !/^\d+$/.test(obj.score)) {
    throw new Error(
      "Invalid serialized state: score must be a decimal integer string."
    );
  }
  let score: bigint;
  try {
    score = BigInt(obj.score);
  } catch {
    throw new Error(
      "Invalid serialized state: score could not be parsed as a bigint."
    );
  }
  return {
    secretKey: new Uint8Array(bytes as number[]),
    score,
  };
}
