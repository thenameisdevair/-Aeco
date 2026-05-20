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

// Normalise private key — ensure 0x prefix.
const AGENT_PRIVATE_KEY = (
  RAW_AGENT_KEY.startsWith("0x") ? RAW_AGENT_KEY : `0x${RAW_AGENT_KEY}`
) as `0x${string}`;

// ─────────────────────────────────────────────────────────────────────────────
// viem clients
// ─────────────────────────────────────────────────────────────────────────────

const transport = http(RPC_URL);

const publicClient = createPublicClient({
  chain:     celo,
  transport,
});

const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY);

const walletClient = createWalletClient({
  account:   agentAccount,
  chain:     celo,
  transport,
});

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
          { name: "deltaFromLast", type: "int8"    },
          { name: "agentVersion",  type: "string"  },
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
      { name: "deltaFromLast", type: "int8"    },
      { name: "agentVersion",  type: "string"  },
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
    const nowSeconds    = Date.now() / 1000;
    const sixHoursAgo   = nowSeconds - 6 * 60 * 60;
    if (lastPostTimestamp < sixHoursAgo) return true;
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
 * @param deltaFromLast - Score change vs previous record (may be negative).
 * @param agentVersion - Semantic version of the agent.
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
): Promise<boolean> {
  const signalUint8 = SIGNAL_TO_UINT8[signal] ?? 0;

  try {
    const txHash = await walletClient.writeContract({
      address:      SENTIMENT_FEED_ADDRESS,
      abi:          sentimentFeedAbi,
      functionName: "postSentiment",
      args: [
        BigInt(subjectId),
        score,
        signalUint8,
        confidence,
        summary,
        sourceType,
        deltaFromLast,
        agentVersion,
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
    const txHash = await walletClient.writeContract({
      address:      HEARTBEAT_ORACLE_ADDRESS,
      abi:          heartbeatOracleAbi,
      functionName: "recordHeartbeat",
      args:         [BigInt(subjectsScanned), significantChange, statusMessage],
    });

    console.log(`[writer] recordHeartbeat | scanned ${subjectsScanned} | tx ${txHash}`);
    return true;
  } catch (err) {
    console.error("[writer] recordHeartbeat failed:", err);
    return false;
  }
}
