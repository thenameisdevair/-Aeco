/**
 * Grok API client for the Aeco agent — uses the xAI Responses API (/v1/responses).
 *
 * Each call enables the x_search and web_search tools so Grok can pull live data
 * from X posts and the web before producing its sentiment score.
 *
 * Reads GROK_API_KEY from the environment. Never throws — errors are logged and
 * the function returns null so the agent loop continues uninterrupted.
 */

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

/** Minimal shape of the xAI Responses API output we need to navigate. */
interface XAIResponsesOutput {
  type: string;
  content?: Array<{ text?: string }>;
}

interface XAIResponsesBody {
  output?: XAIResponsesOutput[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GROK_API_URL = "https://api.x.ai/v1/responses";
const GROK_MODEL   = "grok-3";

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
 * Walks the Responses API `output` array and returns the text content of the
 * first item whose type is "message". Returns an empty string if not found.
 *
 * @param output - The `output` array from the xAI Responses API body.
 * @returns The raw text string from the message item, or "".
 */
function extractMessageText(output: XAIResponsesOutput[]): string {
  const messageItem = output.find((item) => item.type === "message");
  return messageItem?.content?.[0]?.text ?? "";
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

  let rawText: string;

  try {
    const response = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: prompt         },
        ],
        tools: [
          { type: "x_search"   },
          { type: "web_search" },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(unreadable)");
      console.error(`[grok] API request failed — HTTP ${response.status}: ${errorBody}`);
      return null;
    }

    const data = (await response.json()) as XAIResponsesBody;

    if (!Array.isArray(data?.output) || data.output.length === 0) {
      console.error("[grok] API response missing or empty output array.");
      return null;
    }

    rawText = extractMessageText(data.output);

    if (!rawText) {
      console.error("[grok] No message item found in output array.", data.output);
      return null;
    }
  } catch (err) {
    console.error("[grok] Network or fetch error:", err);
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
