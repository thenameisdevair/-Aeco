/**
 * Builds a Grok prompt for scoring the momentum of a macro crypto narrative or topic.
 *
 * @param topic - The narrative or theme to analyse (e.g. "Stablecoin Regulation",
 *                "Africa Crypto Adoption").
 * @returns A complete prompt string ready to be sent to the Grok API.
 */

/**
 * Returns a structured prompt instructing Grok to research a narrative topic
 * across X and news and return a machine-parseable JSON sentiment score.
 *
 * The score represents narrative momentum — how strongly and positively the
 * topic is currently trending, not a price signal.
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
export function buildNarrativePrompt(topic: string): string {
  return `You are a financial sentiment analyst for the Aeco AI oracle, running on the Celo blockchain. Your job is to measure the current momentum and sentiment of a macro crypto narrative or theme.

TOPIC: ${topic}

RESEARCH INSTRUCTIONS:
1. Search X (Twitter) for posts discussing "${topic}" published in the last 6 hours. Focus on posts from credible accounts: researchers, founders, journalists, policy experts, and analysts with meaningful followings. Ignore spam and bot-like accounts.
2. Search for news articles, blog posts, and official statements about "${topic}" published in the last 6 hours.
3. Assess the combined tone: Is this narrative gaining momentum or fading? Is the discussion positive, negative, or divided?

SCORING RULES:
- score is an integer from 0 to 100 representing narrative momentum and sentiment.
- 50 = neutral or low activity. Above 65 = strongly trending positively (bullish for crypto). Below 35 = negative or fading momentum (bearish).
- signal must be exactly one of: "bullish", "bearish", or "neutral" — consistent with the score.
- confidence is 0–100. More credible accounts discussing the topic = higher confidence. If recent activity is low or thin, set confidence below 30 and score close to 50 (neutral).
- summary is plain English, maximum 20 words, no markdown. Describe what is driving the narrative, or note that activity is low if that is the case.

SKIP CONDITION:
Only respond with {"skip": true} if searching for "${topic}" returns absolutely zero results on both X and in news. If any results exist — even sparse or low-quality ones — return a full response with confidence below 30 and a score near 50.

OTHERWISE respond with exactly this JSON and nothing else — no markdown, no code fences, no explanation, no extra fields:
{"skip": false, "score": <integer 0-100>, "signal": "<bullish|bearish|neutral>", "confidence": <integer 0-100>, "summary": "<max 20 words>", "sourceType": "x_posts+news"}`;
}
