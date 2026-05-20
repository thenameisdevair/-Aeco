/**
 * Builds a Grok prompt for scoring the crypto sentiment of a public figure.
 *
 * @param name - Full name of the person to analyse (e.g. "Vitalik Buterin").
 * @returns A complete prompt string ready to be sent to the Grok API.
 */

/**
 * Returns a structured prompt instructing Grok to research a public figure's
 * recent posts and coverage and return a machine-parseable JSON sentiment score.
 *
 * The score represents how bullish the person's current public stance is for
 * the crypto and Celo ecosystem — not general public opinion about the person.
 *
 * Output contract (when data is sufficient):
 * ```json
 * {
 *   "skip": false,
 *   "score": 0-100,
 *   "signal": "bullish" | "bearish" | "neutral",
 *   "confidence": 0-100,
 *   "summary": "<= 20 words plain English",
 *   "sourceType": "x_posts+news"
 * }
 * ```
 * Output contract (when data is insufficient):
 * ```json
 * { "skip": true }
 * ```
 */
export function buildPersonPrompt(name: string): string {
  return `You are a financial sentiment analyst for the Aeco AI oracle, running on the Celo blockchain. Your job is to measure how bullish a public figure's current stance is for the broader crypto and Celo ecosystem.

PERSON: ${name}

RESEARCH INSTRUCTIONS:
1. Search X (Twitter) for the 5 most recent posts by "${name}" or their official account. Note the content and tone of each post — are they promoting crypto, expressing doubt, discussing regulation, or speaking about something unrelated?
2. Also search X for community reactions to their recent posts — are followers reacting positively or negatively?
3. Search for any news articles mentioning "${name}" published in the last 12 hours. Note whether the coverage is positive, negative, or neutral for the crypto ecosystem.

SCORING RULES:
- score is an integer from 0 to 100 representing how bullish "${name}"'s current public stance is for crypto and the Celo ecosystem.
- 50 = neutral or unrelated content. Above 65 = bullish. Below 35 = bearish or hostile.
- signal must be exactly one of: "bullish", "bearish", or "neutral" — consistent with the score.
- confidence is 0–100 and reflects how much recent, usable content you found. More posts and news = higher confidence.
- summary is plain English, maximum 20 words, no markdown. Focus on what the person said or did that drove the score.

SKIP CONDITION:
If "${name}" has not posted on X in the last 12 hours AND there is no news about them in the last 12 hours, respond with exactly:
{"skip": true}

OTHERWISE respond with exactly this JSON and nothing else — no markdown, no code fences, no explanation, no extra fields:
{"skip": false, "score": <integer 0-100>, "signal": "<bullish|bearish|neutral>", "confidence": <integer 0-100>, "summary": "<max 20 words>", "sourceType": "x_posts+news"}`;
}
