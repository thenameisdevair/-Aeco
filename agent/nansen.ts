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
  public_figure_net_flow_usd:    number;
  public_figure_avg_flow_usd:    number;
  public_figure_wallet_count:    number;
  top_pnl_net_flow_usd:          number;
  top_pnl_avg_flow_usd:          number;
  top_pnl_wallet_count:          number;
  whale_net_flow_usd:            number;
  whale_avg_flow_usd:            number;
  whale_wallet_count:            number;
  smart_trader_net_flow_usd:     number;
  smart_trader_avg_flow_usd:     number;
  smart_trader_wallet_count:     number;
  exchange_net_flow_usd:         number;
  exchange_avg_flow_usd:         number;
  exchange_wallet_count:         number;
  fresh_wallets_net_flow_usd:    number;
  fresh_wallets_avg_flow_usd:    number;
  fresh_wallets_wallet_count:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT = "https://api.nansen.ai/api/v1/tgm/flow-intelligence";
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
        chain,
        token_address: tokenAddress,
        timeframe: timeframe ?? "1d",
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

  let json: { data: FlowIntelligence[] };
  try {
    json = await res.json() as { data: FlowIntelligence[] };
  } catch (err) {
    console.error("[nansen] Failed to parse response JSON:", err);
    return null;
  }

  if (!Array.isArray(json.data) || json.data.length === 0) {
    console.error("[nansen] Empty or invalid data array in response");
    return null;
  }

  const item = json.data[0];

  const flowFields: Array<keyof FlowIntelligence> = [
    "public_figure_net_flow_usd", "public_figure_avg_flow_usd", "public_figure_wallet_count",
    "top_pnl_net_flow_usd",       "top_pnl_avg_flow_usd",       "top_pnl_wallet_count",
    "whale_net_flow_usd",         "whale_avg_flow_usd",          "whale_wallet_count",
    "smart_trader_net_flow_usd",  "smart_trader_avg_flow_usd",   "smart_trader_wallet_count",
    "exchange_net_flow_usd",      "exchange_avg_flow_usd",        "exchange_wallet_count",
    "fresh_wallets_net_flow_usd", "fresh_wallets_avg_flow_usd",  "fresh_wallets_wallet_count",
  ];

  const raw = item as unknown as Record<string, unknown>;
  for (const field of flowFields) {
    if (typeof raw[field] !== "number") {
      console.error(`[nansen] Missing or non-numeric field "${field}" in response:`, raw);
      return null;
    }
  }

  return item;
}

/**
 * Reduces a FlowIntelligence record to a single signed USD net flow signal.
 *
 * Formula (from PRD §4): smartTraderFlow + topPnlFlow + (0.5 × whaleFlow).
 * A positive value indicates net smart-money accumulation; negative indicates
 * net distribution.
 */
export function computeFlowSignal(f: FlowIntelligence): number {
  return f.smart_trader_net_flow_usd
    + f.top_pnl_net_flow_usd
    + 0.5 * f.whale_net_flow_usd;
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
