"use strict";
/**
 * Viem public client and contract read helpers for the Aeco oracle API.
 * Reads directly from Celo Mainnet — no private key required.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSentiment = getSentiment;
exports.getAllSentiment = getAllSentiment;
exports.getHeartbeats = getHeartbeats;
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────
const publicClient = (0, viem_1.createPublicClient)({
    chain: chains_1.celo,
    transport: (0, viem_1.http)("https://forno.celo.org"),
});
// ─────────────────────────────────────────────────────────────────────────────
// Contract addresses
// ─────────────────────────────────────────────────────────────────────────────
const SENTIMENT_FEED_ADDRESS = "0x0684191E2e8Ac149F0073875242af19eC08D0724";
const HEARTBEAT_ORACLE_ADDRESS = "0x2199C72E411ed90fB10772259E3194791406EAd9";
// ─────────────────────────────────────────────────────────────────────────────
// Minimal ABIs
// ─────────────────────────────────────────────────────────────────────────────
const sentimentFeedAbi = [
    {
        name: "getLatest",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "subjectId", type: "uint256" }],
        outputs: [{
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
                ],
            }],
    },
];
const heartbeatOracleAbi = [
    {
        name: "getHistory",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "count", type: "uint256" }],
        outputs: [{
                name: "",
                type: "tuple[]",
                components: [
                    { name: "timestamp", type: "uint256" },
                    { name: "subjectsScanned", type: "uint256" },
                    { name: "significantChange", type: "bool" },
                    { name: "statusMessage", type: "string" },
                ],
            }],
    },
];
// ─────────────────────────────────────────────────────────────────────────────
// Signal mapping
// ─────────────────────────────────────────────────────────────────────────────
const SIGNAL_MAP = {
    0: "neutral",
    1: "bullish",
    2: "bearish",
};
/**
 * Reads the latest sentiment record for a subject from SentimentFeed.
 * Returns null if no record exists yet (timestamp === 0) or on any error.
 *
 * @param subjectId - On-chain subject ID (1-indexed).
 */
async function getSentiment(subjectId) {
    try {
        const raw = await publicClient.readContract({
            address: SENTIMENT_FEED_ADDRESS,
            abi: sentimentFeedAbi,
            functionName: "getLatest",
            args: [BigInt(subjectId)],
        });
        const record = raw;
        if (!record || record.timestamp === 0n)
            return null;
        const ts = Number(record.timestamp);
        return {
            subjectId: Number(record.subjectId),
            score: record.score,
            signal: SIGNAL_MAP[record.signal] ?? "neutral",
            confidence: record.confidence,
            summary: record.summary,
            sourceType: record.sourceType,
            timestamp: ts,
            updatedAt: new Date(ts * 1000).toISOString(),
        };
    }
    catch (err) {
        console.error(`[contracts] getSentiment failed for subject ${subjectId}:`, err);
        return null;
    }
}
/**
 * Fetches the latest sentiment records for all 8 subjects in parallel.
 * Subjects with no on-chain record yet are silently omitted.
 */
async function getAllSentiment() {
    const results = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((id) => getSentiment(id)));
    return results.filter((r) => r !== null);
}
/**
 * Reads the last `count` heartbeat records from HeartbeatOracle.
 *
 * @param count - Number of most-recent heartbeats to return.
 */
async function getHeartbeats(count) {
    try {
        const rawRecords = await publicClient.readContract({
            address: HEARTBEAT_ORACLE_ADDRESS,
            abi: heartbeatOracleAbi,
            functionName: "getHistory",
            args: [BigInt(count)],
        });
        const records = rawRecords;
        return records.map((r) => {
            const ts = Number(r.timestamp);
            return {
                timestamp: ts,
                subjectsScanned: Number(r.subjectsScanned),
                significantChange: r.significantChange,
                statusMessage: r.statusMessage,
                updatedAt: new Date(ts * 1000).toISOString(),
            };
        });
    }
    catch (err) {
        console.error("[contracts] getHeartbeats failed:", err);
        return [];
    }
}
