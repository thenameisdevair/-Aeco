/**
 * Thin client for the Grok API (xAI).
 *
 * Reads GROK_API_KEY from the environment. All functions are safe to call in a
 * long-running loop — errors are logged and swallowed; no call ever throws.
 */

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

/** Minimal shape of the xAI chat completions response we need. */
interface XAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-3-mini";

/**
 * Strips markdown code fences from a string so raw JSON can be parsed.
 *
 * Handles both ` ```json\n...\n``` ` and bare ` ```\n...\n``` ` forms.
 *
 * @param text - Raw string from the model response.
 * @returns The string with any surrounding code fences removed.
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
 *
 * @param raw - The result of JSON.parse on the model output.
 * @returns A typed GrokResponse or null.
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

/**
 * Sends a prompt to the Grok API and returns the parsed sentiment response.
 *
 * Uses model `grok-3-mini` with temperature 0.2 to keep outputs deterministic.
 * Markdown code fences in the model reply are stripped before JSON parsing.
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

  let rawText: string;

  try {
    const response = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:       GROK_MODEL,
        temperature: 0.2,
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(unreadable)");
      console.error(
        `[grok] API request failed — HTTP ${response.status}: ${errorBody}`
      );
      return null;
    }

    const data = (await response.json()) as XAIChatResponse;
    rawText = data?.choices?.[0]?.message?.content ?? "";

    if (!rawText) {
      console.error("[grok] API returned an empty content field.");
      return null;
    }
  } catch (err) {
    console.error("[grok] Network or fetch error:", err);
    return null;
  }

  const cleaned = stripCodeFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(
      "[grok] Failed to parse JSON from model response. Raw content:\n",
      rawText
    );
    return null;
  }

  const validated = validateResponse(parsed);
  if (!validated) {
    console.error(
      "[grok] Parsed JSON did not match expected GrokResponse shape:",
      parsed
    );
    return null;
  }

  return validated;
}
