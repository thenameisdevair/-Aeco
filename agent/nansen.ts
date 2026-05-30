/**
 * Nansen TGM Flow Intelligence client for the Aeco hybrid oracle.
 *
 * Powers the smart-money component of the oracle's composite score. Calls
 * /api/beta/tgm/flow-intelligence per prediction-enabled subject (1 credit/call)
 * and reduces the categorized cohort flows to a single signed USD-denominated
 * flow signal: positive = net accumulation by skilled wallets, negative = net
 * distribution.
 *
 * Formula: smartTraderFlow + topPnlFlow + (0.5 × whaleFlow).
 * exchangeFlow and freshWalletsFlow are deliberately excluded — exchange flows
 * are CEX plumbing with no sentiment content; fresh wallets are noise.
 *
 * Reads NANSEN_API_KEY from the environment. Never throws — errors are logged
 * and functions return null so a Nansen failure cannot crash the agent cycle.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Raw response object from the Flow Intelligence endpoint (single array element). */
export interface FlowIntelligence {
  smartTraderFlow:      number;
  topPnlFlow:           number;
  whaleFlow:            number;
  exchangeFlow:         number;
  publicFigureFlow:     number;
  freshWalletsFlow:     number;
  smartTraderWallets:   number;
  topPnlWallets:        number;
  whaleWallets:         number;
  exchangeWallets:      number;
  publicFigureWallets:  number;
  freshWalletsWallets:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT = "https://api.nansen.ai/api/beta/tgm/flow-intelligence";
const DEFAULT_TIMEFRAME = "1d";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches categorized smart-money net flows for a single token.
 *
 * @param chain        - Nansen chain identifier (e.g. "ethereum", "arbitrum").
 * @param tokenAddress - Token contract address on that chain.
 * @param timeframe    - Aggregation window passed to the endpoint. Defaults to "1d".
 *                       Per PRD §5: markets must be ≥1 day; sub-day windows return
 *                       near-zero signal on major assets.
 * @returns Parsed FlowIntelligence on success, or null on any error.
 */
export async function getFlowIntelligence(
  chain: string,
  tokenAddress: string,
  timeframe: string = DEFAULT_TIMEFRAME,
): Promise<FlowIntelligence | null> {
  const apiKey = process.env["NANSEN_API_KEY"];

  if (!apiKey) {
    console.error("[nansen] NANSEN_API_KEY environment variable is not set.");
    return null;
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "apiKey":        apiKey,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        parameters: { chain, tokenAddress, timeframe },
        pagination: { page: 1, recordsPerPage: 100 },
      }),
    });
  } catch (err) {
    console.error("[nansen] Network error calling flow-intelligence:", err);
    return null;
  }

  if (!res.ok) {
    console.error(`[nansen] Non-200 response: ${res.status} ${res.statusText}`);
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    console.error("[nansen] Failed to parse response JSON:", err);
    return null;
  }

  if (!Array.isArray(body) || body.length === 0) {
    console.error("[nansen] Unexpected response shape (expected non-empty array):", body);
    return null;
  }

  const raw = body[0] as Record<string, unknown>;

  const flowFields: Array<keyof FlowIntelligence> = [
    "smartTraderFlow", "topPnlFlow", "whaleFlow",
    "exchangeFlow", "publicFigureFlow", "freshWalletsFlow",
    "smartTraderWallets", "topPnlWallets", "whaleWallets",
    "exchangeWallets", "publicFigureWallets", "freshWalletsWallets",
  ];

  for (const field of flowFields) {
    if (typeof raw[field] !== "number") {
      console.error(`[nansen] Missing or non-numeric field "${field}" in response:`, raw);
      return null;
    }
  }

  return raw as unknown as FlowIntelligence;
}

/**
 * Reduces a FlowIntelligence record to a single signed USD net flow signal.
 *
 * Formula (from PRD §4): smartTraderFlow + topPnlFlow + (0.5 × whaleFlow).
 * A positive value indicates net smart-money accumulation; negative indicates
 * net distribution.
 */
export function computeFlowSignal(f: FlowIntelligence): number {
  return f.smartTraderFlow + f.topPnlFlow + 0.5 * f.whaleFlow;
}

/**
 * Convenience wrapper: fetches flow data and returns the computed signal,
 * or null if the fetch fails.
 *
 * @param chain        - Nansen chain identifier.
 * @param tokenAddress - Token contract address.
 * @param timeframe    - Aggregation window. Defaults to "1d".
 * @returns Signed USD flow signal, or null on any error.
 */
export async function getFlowSignal(
  chain: string,
  tokenAddress: string,
  timeframe: string = DEFAULT_TIMEFRAME,
): Promise<number | null> {
  const data = await getFlowIntelligence(chain, tokenAddress, timeframe);
  if (data === null) return null;
  return computeFlowSignal(data);
}
