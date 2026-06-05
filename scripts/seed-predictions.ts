/**
 * Seeds the PredictionGame contract with an initial batch of on-chain
 * predictions so judges (and the agent's resolution logic) have live data to
 * work with on Celo mainnet.
 *
 * For each subject that already has a SentimentFeed record, this script submits
 * one `makePrediction` transaction, alternating the predicted direction
 * (1 = higher, 2 = lower), waits for the receipt, and logs the confirmed tx
 * hash. It guarantees at least MIN_PREDICTIONS confirmed transactions or exits
 * non-zero.
 *
 * Required environment variables:
 *   RPC_URL          — Celo mainnet JSON-RPC endpoint.
 *   PRIVATE_KEY_USER — 0x-prefixed key for the wallet making predictions.
 *                      Falls back to PRIVATE_KEY_AGENT, then PRIVATE_KEY_DEPLOYER.
 *
 * Usage:
 *   set -a && source .env && npx ts-node scripts/seed-predictions.ts
 */

import dotenv from "dotenv";
dotenv.config();

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** PredictionGame proxy on Celo mainnet (see DEPLOYMENTS.md). */
const PREDICTION_GAME_ADDRESS = "0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC" as Address;

/** SentimentFeed proxy on Celo mainnet — used to confirm a subject has data. */
const SENTIMENT_FEED_ADDRESS =
  (process.env["SENTIMENT_FEED_ADDRESS"] ??
    "0x0684191E2e8Ac149F0073875242af19eC08D0724") as Address;

/** Subject IDs to predict on, in priority order. */
const SUBJECT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Minimum number of confirmed predictions required for success. */
const MIN_PREDICTIONS = 5;

const RPC_URL = process.env["RPC_URL"] ?? "";

const RAW_KEY =
  process.env["PRIVATE_KEY_USER"] ??
  process.env["PRIVATE_KEY_AGENT"] ??
  process.env["PRIVATE_KEY_DEPLOYER"] ??
  "";

const PRIVATE_KEY = (
  RAW_KEY.startsWith("0x") ? RAW_KEY : `0x${RAW_KEY}`
) as `0x${string}`;

// ─────────────────────────────────────────────────────────────────────────────
// ABIs (only what this script calls)
// ─────────────────────────────────────────────────────────────────────────────

const predictionGameAbi = [
  {
    name: "makePrediction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subjectId", type: "uint256" },
      { name: "direction", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "predictionCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const sentimentFeedAbi = [
  {
    name: "getLatest",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "subjectId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "subjectId", type: "uint256" },
          { name: "score", type: "uint8" },
          { name: "signal", type: "uint8" },
          { name: "confidence", type: "uint8" },
          { name: "summary", type: "string" },
          { name: "sourceType", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "deltaFromLast", type: "int8" },
          { name: "agentVersion", type: "string" },
          { name: "socialScore", type: "uint8" },
          { name: "nansenFlow", type: "int256" },
          { name: "divergenceFlag", type: "bool" },
        ],
      },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

const transport = http(RPC_URL);

const publicClient = createPublicClient({ chain: celo, transport });

const account = privateKeyToAccount(PRIVATE_KEY);

const walletClient = createWalletClient({ account, chain: celo, transport });

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function subjectHasData(subjectId: number): Promise<boolean> {
  try {
    const record = await publicClient.readContract({
      address: SENTIMENT_FEED_ADDRESS,
      abi: sentimentFeedAbi,
      functionName: "getLatest",
      args: [BigInt(subjectId)],
    });
    return record.timestamp !== 0n;
  } catch {
    // If the read reverts, treat the subject as having no data.
    return false;
  }
}

async function main(): Promise<void> {
  if (!RPC_URL) throw new Error("RPC_URL is not set");
  if (RAW_KEY === "") throw new Error("No private key set (PRIVATE_KEY_USER / PRIVATE_KEY_AGENT / PRIVATE_KEY_DEPLOYER)");

  console.log("─".repeat(60));
  console.log("Aeco — seeding PredictionGame on Celo mainnet");
  console.log(`  PredictionGame: ${PREDICTION_GAME_ADDRESS}`);
  console.log(`  Caller wallet:  ${account.address}`);
  console.log("─".repeat(60));

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Wallet balance: ${(Number(balance) / 1e18).toFixed(6)} CELO\n`);

  const startCount = await publicClient.readContract({
    address: PREDICTION_GAME_ADDRESS,
    abi: predictionGameAbi,
    functionName: "predictionCount",
  });
  console.log(`Existing predictionCount: ${startCount}\n`);

  let confirmed = 0;
  let attempt = 0;

  for (const subjectId of SUBJECT_IDS) {
    if (confirmed >= MIN_PREDICTIONS) break;

    const hasData = await subjectHasData(subjectId);
    if (!hasData) {
      console.log(`→ Subject ${subjectId}: no sentiment record yet — skipping.`);
      continue;
    }

    // Alternate direction so resolutions later produce a mix of outcomes.
    const direction = attempt % 2 === 0 ? 1 : 2;
    attempt += 1;

    try {
      const nonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      });

      const txHash = await walletClient.writeContract({
        address: PREDICTION_GAME_ADDRESS,
        abi: predictionGameAbi,
        functionName: "makePrediction",
        nonce,
        maxFeePerGas: 2_000_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000_000n,
        args: [BigInt(subjectId), direction],
      });

      console.log(
        `→ Subject ${subjectId} | direction ${direction === 1 ? "HIGHER" : "LOWER"} | tx ${txHash} — submitted`
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === "success") {
        confirmed += 1;
        console.log(
          `  ✓ CONFIRMED makePrediction (${confirmed}/${MIN_PREDICTIONS}) — block ${receipt.blockNumber} | tx ${txHash}`
        );
      } else {
        console.log(`  ✗ REVERTED — subject ${subjectId} | tx ${txHash}`);
      }
    } catch (err) {
      console.error(`  ✗ makePrediction failed for subject ${subjectId}:`, err);
    }
  }

  const endCount = await publicClient.readContract({
    address: PREDICTION_GAME_ADDRESS,
    abi: predictionGameAbi,
    functionName: "predictionCount",
  });

  console.log("\n" + "─".repeat(60));
  console.log(`Confirmed predictions this run: ${confirmed}`);
  console.log(`predictionCount: ${startCount} → ${endCount}`);
  console.log("─".repeat(60));

  if (confirmed < MIN_PREDICTIONS) {
    throw new Error(
      `Only ${confirmed} prediction(s) confirmed — expected at least ${MIN_PREDICTIONS}.`
    );
  }

  console.log(`\n✓ Success — ${confirmed} makePrediction transactions confirmed on Celo mainnet.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-predictions] fatal:", err);
    process.exit(1);
  });
