/**
 * Aeco agent orchestrator.
 *
 * Runs a sentiment cycle every 30 minutes. Each cycle:
 *   1. Fetches price data once from CryptoCompare.
 *   2. Loops through every tracked subject.
 *   3. Builds the correct Grok prompt by category.
 *   4. Calls Grok and parses the response.
 *   5. Reads the last on-chain record for the subject.
 *   6. Decides whether to post using shouldPost().
 *   7. Writes sentiment to SentimentFeed if warranted.
 *   8. Closes the cycle with a heartbeat on HeartbeatOracle.
 *
 * Required environment variables: see writer.ts and grok.ts.
 */

import { fetchPrices }          from "./prices.js";
import { callGrok }             from "./grok.js";
import { buildAssetPrompt }     from "./prompts/assetPrompt.js";
import { buildPersonPrompt }    from "./prompts/personPrompt.js";
import { buildNarrativePrompt } from "./prompts/narrativePrompt.js";
import {
  getLastRecord,
  shouldPost,
  postSentiment,
  recordHeartbeat,
} from "./writer.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Semantic version string stamped on every on-chain sentiment record. */
const AGENT_VERSION = "1.0.0";

/** Category codes that mirror the SentimentFeed Subject.category field. */
const CATEGORY = {
  CRYPTO_ASSET: 1,
  PERSON:       2,
  NARRATIVE:    3,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Subject registry
// ─────────────────────────────────────────────────────────────────────────────

/** Subject IDs must match the order in which addSubject was called in Deploy.s.sol. */
interface Subject {
  id:       number;
  name:     string;
  category: number;
}

const SUBJECTS: Subject[] = [
  { id: 1, name: "CELO",                    category: CATEGORY.CRYPTO_ASSET },
  { id: 2, name: "cUSD",                    category: CATEGORY.CRYPTO_ASSET },
  { id: 3, name: "cKES",                    category: CATEGORY.CRYPTO_ASSET },
  { id: 4, name: "BTC",                     category: CATEGORY.CRYPTO_ASSET },
  { id: 5, name: "ETH",                     category: CATEGORY.CRYPTO_ASSET },
  { id: 6, name: "Vitalik Buterin",          category: CATEGORY.PERSON       },
  { id: 7, name: "Stablecoin Regulation",    category: CATEGORY.NARRATIVE    },
  { id: 8, name: "Africa Crypto Adoption",   category: CATEGORY.NARRATIVE    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs a single full sentiment cycle across all tracked subjects.
 *
 * The function never throws — all errors are caught and logged so that the
 * setInterval loop continues running even after a partial failure.
 *
 * @returns A promise that resolves when the cycle (including heartbeat) is complete.
 */
export async function runCycle(): Promise<void> {
  const cycleStart = Date.now();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[agent] Cycle started at ${new Date(cycleStart).toISOString()}`);
  console.log(`${"─".repeat(60)}`);

  // ── Step 1: Fetch price data once for the whole cycle ─────────────────────
  let prices: Awaited<ReturnType<typeof fetchPrices>> = {};
  try {
    prices = await fetchPrices();
    const available = Object.entries(prices)
      .filter(([, v]) => v !== null)
      .map(([k]) => k)
      .join(", ");
    console.log(`[agent] Prices fetched — available: ${available || "none"}`);
  } catch (err) {
    // fetchPrices should never throw, but guard anyway.
    console.error("[agent] fetchPrices threw unexpectedly:", err);
  }

  let subjectsScanned  = 0;
  let anyPosted        = false;
  const postedSubjects: string[] = [];

  // ── Step 2: Process each subject ──────────────────────────────────────────
  for (const subject of SUBJECTS) {
    console.log(`\n[agent] → Subject ${subject.id}: "${subject.name}" (category ${subject.category})`);
    subjectsScanned += 1;

    // ── 2a. Build prompt ───────────────────────────────────────────────────
    let prompt: string;

    if (subject.category === CATEGORY.CRYPTO_ASSET) {
      const priceData = prices[subject.name] ?? null;

      if (priceData !== null) {
        // Full asset prompt with live price context.
        prompt = buildAssetPrompt(subject.name, priceData);
        console.log(`[agent]   Using asset prompt with live price data.`);
      } else {
        // Stablecoin or unlisted asset — fall back to narrative-style prompt.
        prompt = buildNarrativePrompt(subject.name);
        console.log(`[agent]   No price data for "${subject.name}" — using narrative prompt.`);
      }
    } else if (subject.category === CATEGORY.PERSON) {
      prompt = buildPersonPrompt(subject.name);
      console.log(`[agent]   Using person prompt.`);
    } else {
      prompt = buildNarrativePrompt(subject.name);
      console.log(`[agent]   Using narrative prompt.`);
    }

    // ── 2b. Call Grok ──────────────────────────────────────────────────────
    const grokResponse = await callGrok(prompt);

    if (grokResponse === null) {
      console.log(`[agent]   Grok returned null — skipping subject.`);
      continue;
    }

    if (grokResponse.skip) {
      console.log(`[agent]   Grok skipped "${subject.name}" (insufficient data).`);
      continue;
    }

    const { score, signal, confidence, summary, sourceType } = grokResponse as Required<typeof grokResponse>;
    console.log(
      `[agent]   Grok response — score: ${score} | signal: ${signal} | confidence: ${confidence}`
    );
    console.log(`[agent]   Summary: "${summary}"`);

    // ── 2c. Read last on-chain record ──────────────────────────────────────
    const lastRecord = await getLastRecord(subject.id);

    const lastScore     = lastRecord?.score     ?? null;
    const lastSignal    = lastRecord?.signal    ?? null;
    const lastTimestamp = lastRecord?.timestamp ?? null;

    if (lastRecord) {
      console.log(
        `[agent]   Last on-chain — score: ${lastScore} | signal: ${lastSignal} | ` +
        `posted: ${new Date((lastTimestamp ?? 0) * 1000).toISOString()}`
      );
    } else {
      console.log(`[agent]   No on-chain record yet for subject ${subject.id}.`);
    }

    // ── 2d. Decide whether to post ─────────────────────────────────────────
    const post = shouldPost(score, lastScore, signal, lastSignal, lastTimestamp);

    if (!post) {
      console.log(`[agent]   shouldPost → false — no significant change, skipping.`);
      continue;
    }

    console.log(`[agent]   shouldPost → true — writing to chain.`);

    // ── 2e. Calculate delta ────────────────────────────────────────────────
    const deltaFromLast = lastScore !== null ? score - lastScore : 0;

    // ── 2f. Post to chain ──────────────────────────────────────────────────
    const posted = await postSentiment(
      subject.id,
      score,
      signal,
      confidence,
      summary,
      sourceType,
      deltaFromLast,
      AGENT_VERSION,
    );

    if (posted) {
      anyPosted = true;
      postedSubjects.push(subject.name);
      console.log(`[agent]   ✓ Posted sentiment for "${subject.name}".`);
    } else {
      console.log(`[agent]   ✗ postSentiment failed for "${subject.name}".`);
    }
  }

  // ── Step 3: Record heartbeat ──────────────────────────────────────────────
  const cycleDurationMs = Date.now() - cycleStart;
  const statusMessage   = anyPosted
    ? `Posted ${postedSubjects.length} subject(s): ${postedSubjects.join(", ")}. Cycle: ${cycleDurationMs}ms.`
    : `No posts this cycle. ${subjectsScanned} subjects scanned. Cycle: ${cycleDurationMs}ms.`;

  console.log(`\n[agent] Recording heartbeat — scanned: ${subjectsScanned} | anyPosted: ${anyPosted}`);
  console.log(`[agent] Status: ${statusMessage}`);

  await recordHeartbeat(subjectsScanned, anyPosted, statusMessage);

  console.log(`\n[agent] Cycle complete in ${cycleDurationMs}ms.`);
  console.log(`${"─".repeat(60)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

// Run immediately on startup, then every 30 minutes.
runCycle();
setInterval(runCycle, 30 * 60 * 1000);
