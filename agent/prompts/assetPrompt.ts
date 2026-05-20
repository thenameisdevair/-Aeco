/**
 * Builds a Grok prompt for scoring the sentiment of a crypto asset.
 *
 * @param symbol    - Ticker symbol (e.g. "CELO", "BTC", "ETH").
 * @param priceData - Current market snapshot for the asset.
 * @returns A complete prompt string ready to be sent to the Grok API.
 */

export interface AssetPriceData {
  /** Current USD price. */
  price: number;
  /** Percentage price change over the last 24 hours. */
  change24h: number;
  /** Total USD trading volume over the last 24 hours. */
  volume24h: number;
  /** 24-hour high price in USD. */
  high24h: number;
  /** 24-hour low price in USD. */
  low24h: number;
}

/**
 * Returns a structured prompt instructing Grok to research an asset and return
 * a machine-parseable JSON sentiment score.
 *
 * Output contract (when data is sufficient):
 * ```json
 * {
 *   "skip": false,
 *   "score": 0-100,
 *   "signal": "bullish" | "bearish" | "neutral",
 *   "confidence": 0-100,
 *   "summary": "<= 20 words plain English",
 *   "sourceType": "x_posts+news+price"
 * }
 * ```
 * Output contract (when data is insufficient):
 * ```json
 * { "skip": true }
 * ```
 */
/** Full asset names for well-known symbols, used to broaden X search terms. */
const ASSET_FULL_NAMES: Record<string, string> = {
  CELO: "Celo",
  BTC:  "Bitcoin",
  ETH:  "Ethereum",
};

/**
 * Extra search terms appended for specific symbols where the ticker alone
 * produces too little signal on X.
 */
const EXTRA_SEARCH_TERMS: Record<string, string[]> = {
  CELO: ["Celo blockchain", "Celo network"],
};

export function buildAssetPrompt(symbol: string, priceData: AssetPriceData): string {
  const { price, change24h, volume24h, high24h, low24h } = priceData;

  const fullName  = ASSET_FULL_NAMES[symbol];
  const extraTerms = EXTRA_SEARCH_TERMS[symbol] ?? [];

  // Build the X search term list: always include the ticker; add full name and
  // any symbol-specific extras when available.
  const xSearchTerms = [
    `"${symbol}"`,
    ...(fullName ? [`"${fullName}"`] : []),
    ...extraTerms.map((t) => `"${t}"`),
  ].join(", ");

  // Human-readable label for the skip condition message.
  const assetLabel = fullName ? `${symbol} (${fullName})` : symbol;

  return `You are a financial sentiment analyst for the Aeco AI oracle, running on the Celo blockchain. Your job is to produce a precise, data-driven sentiment score for a crypto asset based on social signals and price action.

ASSET: ${symbol}${fullName ? ` (${fullName})` : ""}

CURRENT PRICE DATA (use this as context, not as the primary signal):
- Price: $${price.toFixed(6)}
- 24h Change: ${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%
- 24h Volume: $${volume24h.toLocaleString("en-US", { maximumFractionDigits: 0 })}
- 24h High: $${high24h.toFixed(6)}
- 24h Low: $${low24h.toFixed(6)}

RESEARCH INSTRUCTIONS:
1. Search X (Twitter) for posts published in the last 2 hours using each of these search terms: ${xSearchTerms}. Combine all results. Focus on posts from credible accounts (traders, analysts, founders, journalists). Note the tone: are people excited, fearful, neutral, or uncertain?
2. Search for news articles and headlines about ${assetLabel} published in the last 4 hours. Note whether coverage is positive, negative, or neutral.
3. Combine what you find from X posts, news, and the price action above into a single sentiment score.

SCORING RULES:
- score is an integer from 0 to 100 where 50 is perfectly neutral.
- Above 65 = bullish. Below 35 = bearish. 35–65 = neutral.
- signal must be exactly one of: "bullish", "bearish", or "neutral" — consistent with the score.
- confidence is 0–100 and reflects how much usable data you found. More posts and news = higher confidence. Sparse data = lower confidence.
- summary is plain English, maximum 20 words, no jargon, no ticker symbols, no markdown.

RESPONSE RULE:
Always return a full sentiment response using the price data provided plus any social data you find. Never return skip:true for assets that have price data.

Respond with exactly this JSON and nothing else — no markdown, no code fences, no explanation, no extra fields:
{"skip": false, "score": <integer 0-100>, "signal": "<bullish|bearish|neutral>", "confidence": <integer 0-100>, "summary": "<max 20 words>", "sourceType": "x_posts+news+price"}`;
}
