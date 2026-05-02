# Score Tracker

A privacy-preserving score counter built on the [Midnight](https://midnight.network) blockchain. The score value is kept in zero-knowledge — it is never revealed on-chain.

## How it works

- A Compact smart contract stores a cryptographic commitment to the score
- ZK proofs verify increments/decrements without exposing the actual value
- Private state (the real score + secret key) lives only on your machine in LevelDB

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for the local devnet)
- Node.js 22+

## Quick start

**1. Start the local devnet**

```bash
docker compose up -d
```

This starts three containers: a Midnight node, an indexer, and a proof server.

**2. Install dependencies**

```bash
npm install
```

**3. Run the tracker**

```bash
npm start
```

## CLI commands

| Command          | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `deploy`         | Deploy a new score contract                                  |
| `join <address>` | Reconnect to an existing contract (requires your secret key) |
| `++`             | Increment the score                                          |
| `--`             | Decrement the score                                          |
| `backup`         | Export private state to a JSON file                          |
| `exit`           | Quit                                                         |

## Environment variables

Both variables are optional for local development — defaults are provided.

| Variable                 | Default                 | Description                              |
| ------------------------ | ----------------------- | ---------------------------------------- |
| `WALLET_SEED`            | `000...001` (test seed) | 32-byte hex wallet seed                  |
| `SCORE_STORAGE_PASSWORD` | `ScoreTracker-Dev1!`    | Password for local LevelDB private state |

## Backups

The `backup` command writes a JSON file (`score-backup-<timestamp>.json`) containing your contract address and secret key. **Keep this file safe** — without it you cannot rejoin your contract after a fresh start.

Do not commit backup files or share them.
