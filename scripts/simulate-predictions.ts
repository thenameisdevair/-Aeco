/**
 * Reads funded wallets from scripts/wallets.json, reads live oracle signals,
 * and makes one prediction per wallet per subject based on the signal.
 * Neutral subjects are skipped. Random delays between wallets avoid bot patterns.
 * Also submits a userRating feedback entry from each wallet.
 *
 * Usage: npx ts-node scripts/simulate-predictions.ts
 *
 * Requires: scripts/wallets.json (run generate-wallets.ts first and fund wallets)
 * Requires: RPC_URL in environment
 */
import * as fs   from "fs";
import * as path from "path";
import dotenv    from "dotenv";
dotenv.config();

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo }                from "viem/chains";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL              = process.env["RPC_URL"] ?? "https://forno.celo.org";
const SENTIMENT_FEED       = "0x0684191E2e8Ac149F0073875242af19eC08D0724" as Address;
const PREDICTION_GAME      = "0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC" as Address;
const REPUTATION_REGISTRY  = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address;
const AGENT_ID             = 9112n;

// Only make predictions on these subjects (have active markets)
const PREDICT_SUBJECTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const sentimentAbi = [{
  name: "getLatest", type: "function", stateMutability: "view",
  inputs:  [{ name: "subjectId", type: "uint256" }],
  outputs: [{ name: "", type: "tuple", components: [
    { name: "subjectId",  type: "uint256" },
    { name: "score",      type: "uint8"   },
    { name: "signal",     type: "uint8"   },
    { name: "confidence", type: "uint8"   },
    { name: "summary",    type: "string"  },
    { name: "sourceType", type: "string"  },
    { name: "timestamp",  type: "uint256" },
    { name: "deltaFromLast", type: "int8" },
    { name: "agentVersion",  type: "string" },
    { name: "socialScore",   type: "uint8"  },
    { name: "nansenFlow",    type: "int256" },
    { name: "divergenceFlag", type: "bool" },
  ]}],
}] as const;

const predictionAbi = [{
  name: "makePrediction", type: "function", stateMutability: "nonpayable",
  inputs:  [
    { name: "subjectId",          type: "uint256" },
    { name: "predictedDirection", type: "uint8"   },
  ],
  outputs: [],
}] as const;

const feedbackAbi = [{
  name: "giveFeedback", type: "function", stateMutability: "nonpayable",
  inputs: [
    { name: "agentId",      type: "uint256" },
    { name: "score",        type: "int128"  },
    { name: "decimals",     type: "uint8"   },
    { name: "tag1",         type: "string"  },
    { name: "tag2",         type: "string"  },
    { name: "endpoint",     type: "string"  },
    { name: "feedbackURI",  type: "string"  },
    { name: "feedbackHash", type: "bytes32" },
  ],
  outputs: [],
}] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs = 3000, maxMs = 12000) {
  return sleep(Math.floor(Math.random() * (maxMs - minMs) + minMs));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load wallets
  const walletsPath = path.join(__dirname, "wallets.json");
  if (!fs.existsSync(walletsPath)) {
    console.error("wallets.json not found. Run: npx ts-node scripts/generate-wallets.ts");
    process.exit(1);
  }
  const wallets: { index: number; address: string; privateKey: `0x${string}` }[] =
    JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  console.log(`\nLoaded ${wallets.length} wallets.`);

  // Public client for reads
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(RPC_URL),
  });

  // Read current oracle signals
  console.log("\nReading oracle signals...");
  const signals: Record<number, { signal: number; score: number }> = {};

  for (const subjectId of PREDICT_SUBJECTS) {
    try {
      const rec = await publicClient.readContract({
        address: SENTIMENT_FEED,
        abi: sentimentAbi,
        functionName: "getLatest",
        args: [BigInt(subjectId)],
      });
      if (rec.timestamp > 0n) {
        signals[subjectId] = { signal: rec.signal, score: rec.score };
        const sigName = ["NEUTRAL", "BULLISH", "BEARISH"][rec.signal] ?? "UNKNOWN";
        console.log(`  Subject ${subjectId}: ${sigName} (score ${rec.score})`);
      }
    } catch (err) {
      console.warn(`  Subject ${subjectId}: failed to read — skipping`);
    }
  }

  // Filter to subjects with non-neutral signals
  const actionableSubjects = PREDICT_SUBJECTS.filter(id => {
    const s = signals[id];
    return s && s.signal !== 0; // 0 = NEUTRAL, skip
  });

  if (actionableSubjects.length === 0) {
    console.log("\nNo non-neutral signals right now. Try again later.");
    process.exit(0);
  }

  console.log(`\nActionable subjects: ${actionableSubjects.join(", ")}`);
  console.log("\nStarting predictions...\n");

  // Process each wallet
  for (const wallet of wallets) {
    console.log(`\n── Wallet ${wallet.index}: ${wallet.address}`);

    const account = privateKeyToAccount(wallet.privateKey);
    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(RPC_URL),
    });

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    const celoBalance = Number(balance) / 1e18;
    if (celoBalance < 0.05) {
      console.log(`  ⚠ Balance too low (${celoBalance.toFixed(4)} CELO) — skipping`);
      continue;
    }
    console.log(`  Balance: ${celoBalance.toFixed(4)} CELO`);

    // Pick one subject to predict (rotate through wallets)
    const subjectId = actionableSubjects[wallet.index % actionableSubjects.length];
    const sig = signals[subjectId];
    if (!sig) continue;

    // Direction: bullish (1) → predict higher (1), bearish (2) → predict lower (2)
    const direction = sig.signal; // 1 = bullish → higher, 2 = bearish → lower
    const dirName   = direction === 1 ? "HIGHER" : "LOWER";

    try {
      // Make prediction
      const predTx = await walletClient.writeContract({
        address:      PREDICTION_GAME,
        abi:          predictionAbi,
        functionName: "makePrediction",
        args:         [BigInt(subjectId), direction],
      });
      console.log(`  ✓ Predicted ${dirName} for subject ${subjectId} | tx ${predTx}`);

      await randomDelay(2000, 5000);

      // Submit feedback
      const feedbackScore = 9000n; // 90.00% — positive user rating
      const feedbackHash  = keccak256(toHex(`userRating-${account.address}-${Date.now()}`));

      const feedTx = await walletClient.writeContract({
        address:      REPUTATION_REGISTRY,
        abi:          feedbackAbi,
        functionName: "giveFeedback",
        args: [
          AGENT_ID,
          feedbackScore,
          2n,
          "userRating",
          "",
          "https://aeco-eight.vercel.app",
          "",
          feedbackHash,
        ],
      });
      console.log(`  ✓ Submitted feedback (90.00%) | tx ${feedTx}`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed: ${msg.slice(0, 100)}`);
    }

    // Random delay between wallets
    await randomDelay(5000, 15000);
  }

  console.log("\n✓ Simulation complete.\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
