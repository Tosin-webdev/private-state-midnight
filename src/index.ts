// src/index.ts

import * as readline from "node:readline";
import { writeFile } from "node:fs/promises";
import {
  type DeployedScoreContract,
  type ScoreProviders,
  LocalConfig,
  configureProviders,
  deployTracker,
  joinTracker,
  increment,
  decrement,
  exportBackup,
} from "./api.js";
import { ScoreWalletProvider } from "./wallet.js";

// Wallet SDK background sync tasks emit unhandled rejections when the
// network is unreachable or when the process exits during active sync.
// Only suppress rejections that originate from wallet SDK internals.
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (
    msg.includes("WebSocket") ||
    msg.includes("disconnected") ||
    msg.includes("Connection reset") ||
    msg.includes("ECONNREFUSED")
  ) {
    return;
  }
  console.error("Unhandled rejection:", reason);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q: string) =>
  new Promise<string>((resolve) => rl.question(q, resolve));

async function main() {
  // ── Config ─────────────────────────────────────────────────────────────────
  // LocalConfig calls setNetworkId('undeployed') in its constructor.
  // Swap to new PreprodConfig() to target the Preprod testnet instead.
  const config = new LocalConfig();

  // ── Wallet setup ──────────────────────────────────────────────────────────
  // LOCAL_TEST_SEED is the number 1 padded to 32 bytes. It is a well-known
  // test value — anyone who sees it can derive the same wallet and drain its funds.
  // NEVER use it on preprod or mainnet. Always set WALLET_SEED to a secret
  // seed you generated yourself before targeting any public network.
  // On the local devnet this address is pre-funded by the genesis block.
  const LOCAL_TEST_SEED =
    "0000000000000000000000000000000000000000000000000000000000000001";
  const seed = process.env.WALLET_SEED ?? LOCAL_TEST_SEED;

  console.log("Connecting to local network...");
  const { provider: walletProvider, address } = await ScoreWalletProvider.build(
    config,
    seed
  );
  console.log(`Wallet address: ${address}`);
  const providers: ScoreProviders = configureProviders(
    walletProvider,
    config,
    address
  );

  let contract: DeployedScoreContract | null = null;

  try {
    console.log(
      "\nScore Tracker ready. Commands: deploy | join <address> | ++ | -- | backup | exit\n"
    );
    while (true) {
      const input = (await ask("> ")).trim();
      const [cmd, ...args] = input.split(" ");

      if (cmd === "deploy") {
        // Deploys the smart contract. The constructor() circuit runs on-chain,
        // calling both witnesses and writing the initial commitment.
        contract = await deployTracker(providers);
      } else if (cmd === "join") {
        // Reconnects to an existing contract at a known address.
        // Requires the original secret key — stored in your backup file.
        const address = args[0];
        if (!address) {
          console.log("Usage: join <contractAddress>");
          continue;
        }
        const secretKeyHex = await ask("Enter your secret key (hex): ");
        const secretKey = Buffer.from(secretKeyHex.trim(), "hex");
        if (secretKey.length !== 32) {
          console.log("Secret key must be 32 bytes (64 hex chars).");
          continue;
        }
        contract = await joinTracker(
          providers,
          address,
          new Uint8Array(secretKey)
        );
      } else if (cmd === "++") {
        if (!contract) {
          console.log("Deploy or join a contract first.");
          continue;
        }
        await increment(contract, providers);
      } else if (cmd === "--") {
        if (!contract) {
          console.log("Deploy or join a contract first.");
          continue;
        }
        await decrement(contract, providers);
      } else if (cmd === "backup") {
        const json = await exportBackup(providers);
        // Write to disk — never print to stdout, which would expose the secret key
        // in terminal history, log files, and screen-sharing sessions.
        const backupPath = `./score-backup-${Date.now()}.json`;
        await writeFile(backupPath, json, "utf8");
        console.log(`Backup written to: ${backupPath}`);
        console.log(
          "Keep this file safe. Do not share it or store it anywhere outside your device."
        );
      } else if (cmd === "exit") {
        break;
      }
    }
  } finally {
    rl.close();
    await walletProvider.stop().catch(() => {});
  }
}

main().catch(console.error);
