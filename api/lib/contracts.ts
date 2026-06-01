/**
 * Viem public client and contract read helpers for the Aeco oracle API.
 * Reads directly from Celo Mainnet — no private key required.
 */

import { createPublicClient, http, type Address } from "viem";
import { celo } from "viem/chains";

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain:     celo,
  transport: http("https://celo-mainnet.g.alchemy.com/v2/vn-E1O50rnrL3DAj_9de2", { timeout: 10000 }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Contract addresses
// ─────────────────────────────────────────────────────────────────────────────

const SENTIMENT_FEED_ADDRESS   = "0x0684191E2e8Ac149F0073875242af19eC08D0724" as Address;
const HEARTBEAT_ORACLE_ADDRESS = "0x2199C72E411ed90fB10772259E3194791406EAd9" as Address;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ABIs
// ─────────────────────────────────────────────────────────────────────────────

const sentimentFeedAbi = [
  {
    name:            "getLatest",
    type:            "function",
    stateMutability: "view",
    inputs:  [{ name: "subjectId", type: "uint256" }],
    outputs: [{
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
        { name: "socialScore",    type: "uint8"  },
        { name: "nansenFlow",     type: "int256" },
        { name: "divergenceFlag", type: "bool"   },
      ],
    }],
  },
] as const;

const heartbeatOracleAbi = [
  {
    name:            "getHistory",
    type:            "function",
    stateMutability: "view",
    inputs:  [{ name: "count", type: "uint256" }],
    outputs: [{
      name: "",
      type: "tuple[]",
      components: [
        { name: "timestamp",        type: "uint256" },
        { name: "subjectsScanned",  type: "uint256" },
        { name: "significantChange", type: "bool"   },
        { name: "statusMessage",    type: "string"  },
      ],
    }],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Signal mapping
// ─────────────────────────────────────────────────────────────────────────────

const SIGNAL_MAP: Record<number, string> = {
  0: "neutral",
  1: "bullish",
  2: "bearish",
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/** Structured sentiment record returned by the API. */
export interface SentimentRecord {
  subjectId:  number;
  score:      number;
  signal:     string;
  confidence: number;
  summary:    string;
  sourceType: string;
  socialScore:    number;
  nansenFlow:     string;   // serialized as string — bigint doesn't JSON-serialize
  divergenceFlag: boolean;
  isHybrid:       boolean;
  timestamp:  number;
  updatedAt:  string;
}

/** Structured heartbeat record returned by the API. */
export interface HeartbeatRecord {
  timestamp:        number;
  subjectsScanned:  number;
  significantChange: boolean;
  statusMessage:    string;
  updatedAt:        string;
}

/**
 * Reads the latest sentiment record for a subject from SentimentFeed.
 * Returns null if no record exists yet (timestamp === 0) or on any error.
 *
 * @param subjectId - On-chain subject ID (1-indexed).
 */
export async function getSentiment(subjectId: number): Promise<SentimentRecord | null> {
  try {
    const raw = await publicClient.readContract({
      address:      SENTIMENT_FEED_ADDRESS,
      abi:          sentimentFeedAbi,
      functionName: "getLatest",
      args:         [BigInt(subjectId)],
    });

    const record = (raw as any);

    if (!record || record.timestamp === 0n) return null;

    const ts = Number(record.timestamp);
    return {
      subjectId:  Number(record.subjectId),
      score:      record.score,
      signal:     SIGNAL_MAP[record.signal] ?? "neutral",
      confidence: record.confidence,
      summary:    record.summary,
      sourceType: record.sourceType,
      socialScore:    record.socialScore,
      nansenFlow:     record.nansenFlow.toString(),
      divergenceFlag: record.divergenceFlag,
      isHybrid:       record.sourceType === "hybrid:grok+nansen",
      timestamp:  ts,
      updatedAt:  new Date(ts * 1000).toISOString(),
    };
  } catch (err) {
    console.error(`[contracts] getSentiment failed for subject ${subjectId}:`, err);
    return null;
  }
}

/**
 * Fetches the latest sentiment records for all 8 subjects in parallel.
 * Subjects with no on-chain record yet are silently omitted.
 */
export async function getAllSentiment(): Promise<SentimentRecord[]> {
  const results = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => getSentiment(id))
  );
  return results.filter((r): r is SentimentRecord => r !== null);
}

/**
 * Returns only subjects where social sentiment and Nansen smart-money
 * flow disagree — the premium divergence signal.
 * Returns an empty array if no divergences exist right now.
 */
export async function getDivergence(): Promise<SentimentRecord[]> {
  const all = await getAllSentiment();
  return all.filter(r => r.divergenceFlag && r.isHybrid);
}

/**
 * Reads the last `count` heartbeat records from HeartbeatOracle.
 *
 * @param count - Number of most-recent heartbeats to return.
 */
export async function getHeartbeats(count: number): Promise<HeartbeatRecord[]> {
  try {
    const rawRecords = await publicClient.readContract({
      address:      HEARTBEAT_ORACLE_ADDRESS,
      abi:          heartbeatOracleAbi,
      functionName: "getHistory",
      args:         [BigInt(count)],
    });

    const records = rawRecords as any[];

    return records.map((r) => {
      const ts = Number(r.timestamp);
      return {
        timestamp:         ts,
        subjectsScanned:   Number(r.subjectsScanned),
        significantChange: r.significantChange,
        statusMessage:     r.statusMessage,
        updatedAt:         new Date(ts * 1000).toISOString(),
      };
    });
  } catch (err) {
    console.error("[contracts] getHeartbeats failed:", err);
    return [];
  }
}
