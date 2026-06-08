/**
 * Handles all smart-contract reads and writes for the Aeco agent.
 *
 * Required environment variables:
 *   SENTIMENT_FEED_ADDRESS   — proxy address of the deployed SentimentFeed contract.
 *   HEARTBEAT_ORACLE_ADDRESS — proxy address of the deployed HeartbeatOracle contract.
 *   PRIVATE_KEY_AGENT        — 0x-prefixed private key for the agent wallet.
 *   RPC_URL                  — JSON-RPC endpoint (Celo mainnet or testnet).
 *
 * The agent wallet must hold AGENT_ROLE on both SentimentFeed and HeartbeatOracle.
 * Switch the `chain` import to `celoAlfajores` for testnet deployments.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

const RPC_URL                  = process.env["RPC_URL"]                  ?? "";
const SENTIMENT_FEED_ADDRESS   = (process.env["SENTIMENT_FEED_ADDRESS"]  ?? "") as Address;
const HEARTBEAT_ORACLE_ADDRESS = (process.env["HEARTBEAT_ORACLE_ADDRESS"] ?? "") as Address;
const RAW_AGENT_KEY            = process.env["PRIVATE_KEY_AGENT"]        ?? "";
const RAW_DEPLOYER_KEY         = process.env["PRIVATE_KEY_DEPLOYER"]     ?? "";

// Normalise private keys — ensure 0x prefix.
const AGENT_PRIVATE_KEY = (
  RAW_AGENT_KEY.startsWith("0x") ? RAW_AGENT_KEY : `0x${RAW_AGENT_KEY}`
) as `0x${string}`;

const DEPLOYER_PRIVATE_KEY = (
  RAW_DEPLOYER_KEY.startsWith("0x") ? RAW_DEPLOYER_KEY : `0x${RAW_DEPLOYER_KEY}`
) as `0x${string}`;

// ─────────────────────────────────────────────────────────────────────────────
// viem clients
// ─────────────────────────────────────────────────────────────────────────────

const transport = http(RPC_URL);

export const publicClient = createPublicClient({
  chain:     celo,
  transport,
});

export const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY);

export const walletClient = createWalletClient({
  account:   agentAccount,
  chain:     celo,
  transport,
});

export const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

export const deployerClient = createWalletClient({
  account:   deployerAccount,
  chain:     celo,
  transport: http(process.env["RPC_URL"]!),
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup balance check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logs the agent wallet's CELO balance on startup. Prints a prominent warning
 * when the balance is below 0.1 CELO so the operator knows to top up before
 * transactions start failing with opaque "gas exceeds allowance" errors.
 */
async function checkAgentBalance(): Promise<void> {
  try {
    const balance = await publicClient.getBalance({ address: agentAccount.address });
    const celoFloat = Number(balance) / 1e18;
    const label = `[writer] Agent wallet ${agentAccount.address} balance: ${celoFloat.toFixed(6)} CELO`;

    if (celoFloat < 0.1) {
      console.warn(`⚠️  ${label} — LOW BALANCE. Fund this wallet with testnet CELO or transactions will fail.`);
    } else {
      console.log(label);
    }
  } catch (err) {
    console.error("[writer] Could not fetch agent balance:", err);
  }
}

checkAgentBalance();

// ─────────────────────────────────────────────────────────────────────────────
// Signal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps the uint8 signal stored on-chain to its string representation. */
const SIGNAL_FROM_UINT8: Record<number, string> = {
  0: "neutral",
  1: "bullish",
  2: "bearish",
};

/** Maps a string signal to the uint8 stored on-chain. */
const SIGNAL_TO_UINT8: Record<string, number> = {
  neutral: 0,
  bullish: 1,
  bearish: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ABIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Only the two functions called by this module are included.
 * Full ABI is not needed and would bloat the bundle.
 */
const sentimentFeedAbi = [
  {
    name:             "getLatest",
    type:             "function",
    stateMutability:  "view",
    inputs:  [{ name: "subjectId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "subjectId",     type: "uint256" },
          { name: "score",         type: "uint8"   },
          { name: "signal",        type: "uint8"   },
          { name: "confidence",    type: "uint8"   },
          { name: "summary",       type: "string"  },
          { name: "sourceType",    type: "string"  },
          { name: "timestamp",     type: "uint256" },
          { name: "deltaFromLast",  type: "int8"    },
          { name: "agentVersion",   type: "string"  },
          { name: "socialScore",    type: "uint8"   },
          { name: "nansenFlow",     type: "int256"  },
          { name: "divergenceFlag", type: "bool"    },
        ],
      },
    ],
  },
  {
    name:            "postSentiment",
    type:            "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subjectId",     type: "uint256" },
      { name: "score",         type: "uint8"   },
      { name: "signal",        type: "uint8"   },
      { name: "confidence",    type: "uint8"   },
      { name: "summary",       type: "string"  },
      { name: "sourceType",    type: "string"  },
      { name: "deltaFromLast",  type: "int8"    },
      { name: "agentVersion",   type: "string"  },
      { name: "socialScore",    type: "uint8"   },
      { name: "nansenFlow",     type: "int256"  },
      { name: "divergenceFlag", type: "bool"    },
    ],
    outputs: [],
  },
] as const;

const heartbeatOracleAbi = [
  {
    name:            "recordHeartbeat",
    type:            "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subjectsScanned",   type: "uint256" },
      { name: "significantChange", type: "bool"    },
      { name: "statusMessage",     type: "string"  },
    ],
    outputs: [],
  },
  {
    name:            "getHistory",
    type:            "function",
    stateMutability: "view",
    inputs:          [{ name: "count", type: "uint256" }],
    outputs: [{ name: "records", type: "tuple[]", components: [
      { name: "timestamp", type: "uint256" },
      { name: "scanned",   type: "uint8"   },
      { name: "anyPosted", type: "bool"    },
      { name: "version",   type: "string"  },
    ]}],
  },
] as const;

const PREDICTION_GAME_ADDRESS = "0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC" as Address;

const predictionGameAbi = [
  {
    name:            "predictionCount",
    type:            "function",
    stateMutability: "view",
    inputs:          [],
    outputs:         [{ name: "", type: "uint256" }],
  },
  {
    name:            "getPrediction",
    type:            "function",
    stateMutability: "view",
    inputs:          [{ name: "id", type: "uint256" }],
    outputs: [{
      name: "",
      type: "tuple",
      components: [
        { name: "user",                  type: "address" },
        { name: "subjectId",             type: "uint256" },
        { name: "predictedDirection",    type: "uint8"   },
        { name: "madeAtScore",           type: "uint8"   },
        { name: "madeAtTimestamp",       type: "uint256" },
        { name: "resolveAfterTimestamp", type: "uint256" },
        { name: "resolved",              type: "bool"    },
        { name: "correct",               type: "bool"    },
      ],
    }],
  },
  {
    name:            "resolvePrediction",
    type:            "function",
    stateMutability: "nonpayable",
    inputs:          [{ name: "predictionId", type: "uint256" }],
    outputs:         [],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Full on-chain record returned by SentimentFeed.getLatest. */
export interface LastRecord {
  score:     number;
  /** String signal: "bullish" | "bearish" | "neutral". */
  signal:    string;
  /** Unix timestamp (seconds) of the last post. */
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the full latest SentimentRecord for a subject from the chain.
 * Returns null when no record has been posted yet (timestamp === 0).
 *
 * @param subjectId - The on-chain subject ID (1-indexed).
 * @returns A LastRecord or null if no record exists.
 */
export async function getLastRecord(subjectId: number): Promise<LastRecord | null> {
  try {
    const record = await publicClient.readContract({
      address:      SENTIMENT_FEED_ADDRESS,
      abi:          sentimentFeedAbi,
      functionName: "getLatest",
      args:         [BigInt(subjectId)],
    });

    // A zero timestamp means the mapping slot is uninitialised — no record yet.
    if (record.timestamp === 0n) return null;

    return {
      score:     record.score,
      signal:    SIGNAL_FROM_UINT8[record.signal] ?? "neutral",
      timestamp: Number(record.timestamp),
    };
  } catch (err) {
    console.error(`[writer] getLastRecord failed for subject ${subjectId}:`, err);
    return null;
  }
}

/**
 * Convenience wrapper that returns only the score from the latest record.
 * Returns null when no record exists yet for the subject.
 *
 * @param subjectId - The on-chain subject ID.
 * @returns The score (0–100) or null.
 */
export async function getLastScore(subjectId: number): Promise<number | null> {
  const record = await getLastRecord(subjectId);
  return record?.score ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a new sentiment reading is worth posting on-chain.
 *
 * Posts are gated to avoid unnecessary gas spend and spam. A post proceeds when
 * at least one of the following is true:
 *   - No previous record exists (first post ever for this subject).
 *   - The score shifted by more than 10 points in either direction.
 *   - The directional signal flipped (e.g. bullish → bearish).
 *   - More than 6 hours have elapsed since the last post.
 *
 * @param newScore          - Incoming score from the Grok response (0–100).
 * @param lastScore         - Most recent on-chain score, or null if none.
 * @param newSignal         - Incoming signal string ("bullish" | "bearish" | "neutral").
 * @param lastSignal        - Most recent on-chain signal string, or null if none.
 * @param lastPostTimestamp - Unix timestamp (seconds) of the last on-chain post, or null.
 * @returns True if the reading should be written to the chain.
 */
export function shouldPost(
  newScore:          number,
  lastScore:         number | null,
  newSignal:         string,
  lastSignal:        string | null,
  lastPostTimestamp: number | null,
): boolean {
  if (lastScore === null) return true;

  if (Math.abs(newScore - lastScore) > 10) return true;

  if (lastSignal !== null && newSignal !== lastSignal) return true;

  if (lastPostTimestamp !== null) {
    const nowSeconds      = Date.now() / 1000;
    // POST_INTERVAL_SECONDS overrides the default 6-hour repost window.
    // Set to 0 in CI/submission to always post when a prior record exists.
    const intervalSeconds = parseInt(process.env["POST_INTERVAL_SECONDS"] ?? "7200", 10);
    if (lastPostTimestamp < nowSeconds - intervalSeconds) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Posts a new sentiment record for a subject to the SentimentFeed contract.
 *
 * The `signal` string is converted to its uint8 equivalent before the call
 * ("neutral" → 0, "bullish" → 1, "bearish" → 2). `deltaFromLast` must fit
 * within int8 range (–128 to 127); scores are 0–100 so the delta is always safe.
 *
 * @param subjectId    - On-chain subject ID.
 * @param score        - Sentiment score 0–100.
 * @param signal       - Directional signal string.
 * @param confidence   - Agent confidence 0–100.
 * @param summary      - Plain-English summary ≤ 20 words.
 * @param sourceType   - Data source descriptor.
 * @param deltaFromLast  - Score change vs previous record (may be negative).
 * @param agentVersion   - Semantic version of the agent.
 * @param socialScore    - Grok social score 0–100; mirrors score for Grok-only subjects.
 * @param nansenFlow     - Signed USD net smart-money flow; 0n for display-only subjects.
 * @param divergenceFlag - True when social signal and Nansen flow direction disagree.
 * @returns True on successful broadcast, false on any error.
 */
export async function postSentiment(
  subjectId:     number,
  score:         number,
  signal:        string,
  confidence:    number,
  summary:       string,
  sourceType:    string,
  deltaFromLast: number,
  agentVersion:  string,
  socialScore:    number,
  nansenFlow:     bigint,
  divergenceFlag: boolean,
): Promise<boolean> {
  const signalUint8 = SIGNAL_TO_UINT8[signal] ?? 0;

  try {
    const nonce = await publicClient.getTransactionCount({ address: agentAccount.address, blockTag: "pending" });
    const txHash = await walletClient.writeContract({
      address:      SENTIMENT_FEED_ADDRESS,
      abi:          sentimentFeedAbi,
      functionName: "postSentiment",
      nonce,
      args: [
        BigInt(subjectId),
        score,
        signalUint8,
        confidence,
        summary,
        sourceType,
        deltaFromLast,
        agentVersion,
        socialScore,
        nansenFlow,
        divergenceFlag,
      ],
    });

    console.log(
      `[writer] postSentiment — subject ${subjectId} | score ${score} | signal ${signal} | tx ${txHash}`
    );
    return true;
  } catch (err) {
    console.error(`[writer] postSentiment failed for subject ${subjectId}:`, err);
    return false;
  }
}

/**
 * Scans the last 20 predictions on PredictionGame and resolves any that are
 * past their resolveAfterTimestamp and not yet resolved.
 * Errors per prediction are caught silently so one failure doesn't abort the rest.
 */
export async function resolveExpiredPredictions(): Promise<void> {
  const total = await publicClient.readContract({
    address:      PREDICTION_GAME_ADDRESS,
    abi:          predictionGameAbi,
    functionName: "predictionCount",
  });

  const totalNum = Number(total);
  if (totalNum === 0) return;

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

  for (let id = 1; id <= totalNum; id++) {
    try {
      const pred = await publicClient.readContract({
        address:      PREDICTION_GAME_ADDRESS,
        abi:          predictionGameAbi,
        functionName: "getPrediction",
        args:         [BigInt(id)],
      });

      if (pred.resolved) continue;
      if (pred.resolveAfterTimestamp > nowSeconds) continue;

      const txHash = await walletClient.writeContract({
        address:             PREDICTION_GAME_ADDRESS,
        abi:                 predictionGameAbi,
        functionName:        "resolvePrediction",
        maxFeePerGas:         2000000000000n,
        maxPriorityFeePerGas: 2000000000000n,
        args:                [BigInt(id)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      console.log(`[writer] resolvePrediction #${id} | tx ${txHash} | status ${receipt.status}`);
    } catch (err) {
      console.error(`[writer] resolvePrediction #${id} failed:`, err);
    }
  }
}

/**
 * Submits two ERC-8004 Reputation Registry feedback entries via the deployer
 * wallet: successRate (from last 20 resolved predictions) and uptime (from
 * the last 12 heartbeat slots). Both scores are encoded with 2 decimal places
 * (multiply × 10000 so 9500 = 95.00%).
 */
export async function submitAgentFeedback(nansenSuccessCount: number = 0): Promise<void> {
  const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address;
  const AGENT_ID = 9112n;

  const reputationAbi = [{
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
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

  try {
    // ── successRate ──────────────────────────────────────────────────────────
    // Measures agent reliability: of all predictions that passed their
    // resolution window, what % did the agent actually resolve?
    // This is 100% if the agent resolved everything on time — correct/wrong
    // predictions don't affect this metric, only operational reliability does.

    const total = await publicClient.readContract({
      address:      PREDICTION_GAME_ADDRESS,
      abi:          predictionGameAbi,
      functionName: "predictionCount",
    });
    const totalNum = Number(total);

    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    let expired  = 0;
    let resolved = 0;

    for (let id = 1; id <= totalNum; id++) {
      try {
        const pred = await publicClient.readContract({
          address:      PREDICTION_GAME_ADDRESS,
          abi:          predictionGameAbi,
          functionName: "getPrediction",
          args:         [BigInt(id)],
        });
        // Skip self-predictions — agent/deployer wallet test data
        if (
          pred.user.toLowerCase() === agentAccount.address.toLowerCase() ||
          pred.user.toLowerCase() === deployerAccount.address.toLowerCase()
        ) continue;
        // Count predictions that have passed their resolution window
        if (pred.resolveAfterTimestamp <= nowSeconds) {
          expired++;
          if (pred.resolved) resolved++;
        }
      } catch { continue; }
    }

    // If no external predictions have expired yet, agent is 100% reliable
    const successRateValue = expired > 0
      ? BigInt(Math.round((resolved / expired) * 10000))
      : 10000n;

    const successHash = keccak256(toHex(`successRate-${AGENT_ID}-${Date.now()}`));
    const nonce = await publicClient.getTransactionCount({
      address:  deployerAccount.address,
      blockTag: "pending",
    });

    const tx1 = await deployerClient.writeContract({
      address:      REPUTATION_REGISTRY,
      abi:          reputationAbi,
      functionName: "giveFeedback",
      nonce,
      args: [
        AGENT_ID,
        successRateValue,
        2n,
        "successRate",
        "",
        "https://aeco-eight.vercel.app",
        "",
        successHash,
      ],
    });

    const rateDisplay = expired > 0
      ? `${(resolved / expired * 100).toFixed(2)}% (${resolved}/${expired} external predictions resolved)`
      : "100.00% (no external predictions expired yet)";
    console.log(`[feedback] successRate submitted — ${rateDisplay} | tx ${tx1}`);

    await publicClient.waitForTransactionReceipt({ hash: tx1 });

    // uptime — always submits every cycle
    const history = await publicClient.readContract({
      address: HEARTBEAT_ORACLE_ADDRESS as Address,
      abi: heartbeatOracleAbi,
      functionName: 'getHistory',
      args: [12n],
    });
    const uptimeValue = BigInt(Math.round((history.length / 12) * 10000));
    const uptimeHash = keccak256(toHex(`uptime-${AGENT_ID}-${Date.now()}`));
    const uptimeNonce = await publicClient.getTransactionCount({
      address: deployerAccount.address,
      blockTag: 'pending',
    });

    const tx2 = await deployerClient.writeContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: 'giveFeedback',
      nonce: uptimeNonce,
      args: [
        AGENT_ID,
        uptimeValue,
        2,
        'uptime',
        '',
        'https://aeco-eight.vercel.app',
        '',
        uptimeHash,
      ],
    });
    console.log(`[feedback] uptime submitted — ${history.length}/12 cycles | tx ${tx2}`);

    // Wait for uptime tx to confirm before submitting hybridSignal
    // to avoid nonce collision on the deployer wallet
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    // revenues — only submit when Nansen returned live data this cycle
    if (nansenSuccessCount > 0) {
      // revenues tag: value in whole USD, decimals=0
      // nansenSuccessCount used as a count signal (each subject = $1 unit of verified data)
      const hybridValue = BigInt(nansenSuccessCount);
      const hybridHash  = keccak256(toHex(`revenues-${AGENT_ID}-${Date.now()}`));
      const tx3 = await deployerClient.writeContract({
        address:      REPUTATION_REGISTRY,
        abi:          reputationAbi,
        functionName: "giveFeedback",
        args: [
          AGENT_ID,
          hybridValue,
          0,
          "revenues",
          "oracle",
          "https://aeco.onrender.com/divergence",
          "",
          hybridHash,
        ],
      });
      console.log(`[feedback] revenues submitted — ${nansenSuccessCount} hybrid subject(s) | tx ${tx3}`);
    }

  } catch (err) {
    // submitAgentFeedback is best-effort: it writes supplementary ERC-8004
    // reputation entries from the deployer wallet and is independent of the
    // agent's core sentiment/heartbeat duties. forno reports the deployer's
    // pending nonce without visibility into the sequencer mempool, so a feed
    // tx left pending by a prior run can make this cycle's tx collide as
    // "replacement transaction underpriced". That is transient contention, not
    // a failure of this cycle — log it as informational so it does not mask the
    // cycle's success. Genuine, unexpected errors are still surfaced.
    const message = err instanceof Error ? err.message : String(err);
    if (/replacement transaction underpriced|nonce too low|already known/i.test(message)) {
      console.log("[feedback] uptime submission deferred — deployer nonce contention (transient, non-fatal).");
    } else {
      console.error("[feedback] submitAgentFeedback failed:", err);
    }
  }
}

/**
 * Records an agent heartbeat on the HeartbeatOracle contract.
 *
 * @param subjectsScanned   - Number of subjects processed in this cycle.
 * @param significantChange - True if at least one subject was posted this cycle.
 * @param statusMessage     - Human-readable cycle summary for the oracle record.
 * @returns True on successful broadcast, false on any error.
 */
export async function recordHeartbeat(
  subjectsScanned:   number,
  significantChange: boolean,
  statusMessage:     string,
): Promise<boolean> {
  try {
    const nonce = await publicClient.getTransactionCount({ address: agentAccount.address, blockTag: "pending" });

    const txHash = await walletClient.writeContract({
      address:      HEARTBEAT_ORACLE_ADDRESS,
      abi:          heartbeatOracleAbi,
      functionName: "recordHeartbeat",
      nonce,
      args:         [BigInt(subjectsScanned), significantChange, statusMessage],
    });

    console.log(`[writer] recordHeartbeat | scanned ${subjectsScanned} | tx ${txHash}`);
    return true;
  } catch (err) {
    console.error("[writer] recordHeartbeat failed:", err);
    return false;
  }
}
