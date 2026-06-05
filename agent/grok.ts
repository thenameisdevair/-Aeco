/**
 * Grok API client for the Aeco agent — uses the OpenAI SDK pointed at xAI.
 *
 * Each call enables the x_search and web_search tools so Grok can pull live
 * data from X posts and the web before producing its sentiment score.
 *
 * Reads GROK_API_KEY from the environment. Never throws — errors are logged
 * and the function returns null so the agent loop continues uninterrupted.
 */

import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of a successful, parsed response from the oracle prompts. */
export type GrokResponse = {
  /** When true the agent skipped this subject due to insufficient data. */
  skip: boolean;
  /** Sentiment score 0–100. Only present when skip is false. */
  score?: number;
  /** Directional signal. Only present when skip is false. */
  signal?: "bullish" | "bearish" | "neutral";
  /** Agent confidence 0–100. Only present when skip is false. */
  confidence?: number;
  /** Plain-English summary ≤ 20 words. Only present when skip is false. */
  summary?: string;
  /** Pipe-separated source descriptor. Only present when skip is false. */
  sourceType?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GROK_MODEL = "grok-3-mini";

/**
 * System prompt prepended to every request. Keeps it short and instruction-only
 * so the bulk of each model context window is used by the user prompt.
 */
const SYSTEM_PROMPT =
  "You are a financial sentiment analyst for the Aeco oracle. " +
  "Always respond with valid JSON only. No markdown, no explanation.";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences from a string so raw JSON can be parsed.
 * Handles both ` ```json\n...\n``` ` and bare ` ```\n...\n``` ` forms.
 */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Validates that a parsed object matches the GrokResponse shape closely enough
 * to be used safely. Returns the typed value or null if validation fails.
 */
function validateResponse(raw: unknown): GrokResponse | null {
  if (typeof raw !== "object" || raw === null) return null;

  const obj = raw as Record<string, unknown>;

  if (typeof obj["skip"] !== "boolean") return null;

  if (obj["skip"] === true) {
    return { skip: true };
  }

  // When skip is false all other fields are required.
  if (
    typeof obj["score"]      !== "number" ||
    typeof obj["signal"]     !== "string" ||
    typeof obj["confidence"] !== "number" ||
    typeof obj["summary"]    !== "string" ||
    typeof obj["sourceType"] !== "string"
  ) {
    return null;
  }

  const signal = obj["signal"] as string;
  if (signal !== "bullish" && signal !== "bearish" && signal !== "neutral") {
    return null;
  }

  return {
    skip:       false,
    score:      obj["score"]      as number,
    signal:     signal            as "bullish" | "bearish" | "neutral",
    confidence: obj["confidence"] as number,
    summary:    obj["summary"]    as string,
    sourceType: obj["sourceType"] as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a sentiment prompt to the Grok Responses API and returns the parsed result.
 *
 * The `prompt` parameter is used as the user message. A fixed system message
 * instructs the model to return JSON only. Both x_search and web_search tools
 * are enabled so Grok can search X posts and the web before responding.
 *
 * Markdown code fences in the reply are stripped before JSON parsing.
 *
 * @param prompt - A fully-formed prompt string (from one of the prompt builders).
 * @returns A typed GrokResponse on success, or null if the call fails or the
 *          response cannot be parsed.
 */
export async function callGrok(prompt: string): Promise<GrokResponse | null> {
  const apiKey = process.env["GROK_API_KEY"];

  if (!apiKey) {
    console.error("[grok] GROK_API_KEY environment variable is not set.");
    return null;
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });

  let rawText: string;

  try {
    const response = await client.responses.create({
      model: GROK_MODEL,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: prompt         },
      ],
      tools: [
        { type: "web_search" },
        { type: "x_search"   },
      ],
    } as Parameters<typeof client.responses.create>[0]);

    rawText = (response as { output_text: string }).output_text;

    if (!rawText) {
      console.error("[grok] response.output_text is empty.");
      return null;
    }
  } catch (err) {
    console.error("[grok] API call failed:", err);
    return null;
  }

  console.log("[grok debug] raw response:", rawText);

  const cleaned = stripCodeFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[grok] Failed to parse JSON from model response. Raw content:\n", rawText);
    return null;
  }

  const validated = validateResponse(parsed);
  if (!validated) {
    console.error("[grok] Parsed JSON did not match expected GrokResponse shape:", parsed);
    return null;
  }

  return validated;
}
