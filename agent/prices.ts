/**
 * Fetches current market data for tracked crypto assets from CryptoCompare.
 *
 * Only CELO, BTC, and ETH are fetched because cUSD and cKES are USD-pegged
 * stablecoins and cKES is not listed on CryptoCompare's PRICEMULTIFULL endpoint.
 * Callers that need price data for stablecoins should supply hardcoded values.
 *
 * All functions are safe to call in a long-running loop — errors are logged
 * and swallowed; no call ever throws.
 */

/** Market snapshot for a single asset at the time of the fetch. */
export interface PriceData {
  /** Current USD mid price. */
  price: number;
  /** Percentage price change over the previous 24 hours. */
  change24h: number;
  /** Total USD-denominated trading volume over the previous 24 hours. */
  volume24h: number;
  /** Highest USD price reached in the previous 24 hours. */
  high24h: number;
  /** Lowest USD price reached in the previous 24 hours. */
  low24h: number;
}

/** Symbols requested from CryptoCompare in a single call. */
const SYMBOLS = ["CELO", "BTC", "ETH"] as const;
type Symbol = (typeof SYMBOLS)[number];

const CRYPTOCOMPARE_URL =
  `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${SYMBOLS.join(",")}&tsyms=USD`;

/**
 * Shape of the CryptoCompare PRICEMULTIFULL RAW entry we rely on.
 * The full response contains more fields; we only type what we read.
 */
interface CryptoCompareRawEntry {
  PRICE:            number;
  CHANGEPCT24HOUR:  number;
  VOLUME24HOUR:     number;
  HIGH24HOUR:       number;
  LOW24HOUR:        number;
}

interface CryptoCompareResponse {
  RAW?: {
    [symbol: string]: {
      USD?: CryptoCompareRawEntry;
    };
  };
}

/**
 * Extracts a PriceData object from a single RAW USD entry.
 * Returns null if any required field is missing or not a finite number.
 *
 * @param entry - The RAW.SYMBOL.USD object from the CryptoCompare response.
 * @returns A typed PriceData or null.
 */
function extractPriceData(entry: CryptoCompareRawEntry | undefined): PriceData | null {
  if (!entry) return null;

  const { PRICE, CHANGEPCT24HOUR, VOLUME24HOUR, HIGH24HOUR, LOW24HOUR } = entry;

  if (
    !Number.isFinite(PRICE)           ||
    !Number.isFinite(CHANGEPCT24HOUR) ||
    !Number.isFinite(VOLUME24HOUR)    ||
    !Number.isFinite(HIGH24HOUR)      ||
    !Number.isFinite(LOW24HOUR)
  ) {
    return null;
  }

  return {
    price:     PRICE,
    change24h: CHANGEPCT24HOUR,
    volume24h: VOLUME24HOUR,
    high24h:   HIGH24HOUR,
    low24h:    LOW24HOUR,
  };
}

/**
 * Fetches current price data for CELO, BTC, and ETH from CryptoCompare.
 *
 * Returns a record keyed by symbol. Each value is either a populated PriceData
 * object or null when the symbol's data could not be extracted. The function
 * always returns a complete record for every symbol in SYMBOLS — it never
 * omits a key, so callers can safely index without an existence check.
 *
 * @returns A promise that resolves to `Record<"CELO" | "BTC" | "ETH", PriceData | null>`.
 */
export async function fetchPrices(): Promise<Record<string, PriceData | null>> {
  const result: Record<string, PriceData | null> = {
    CELO: null,
    BTC:  null,
    ETH:  null,
  };

  let data: CryptoCompareResponse;

  try {
    const response = await fetch(CRYPTOCOMPARE_URL);

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      console.error(
        `[prices] CryptoCompare request failed — HTTP ${response.status}: ${body}`
      );
      return result;
    }

    data = (await response.json()) as CryptoCompareResponse;
  } catch (err) {
    console.error("[prices] Network or fetch error:", err);
    return result;
  }

  if (!data.RAW) {
    console.error("[prices] CryptoCompare response missing RAW field.");
    return result;
  }

  for (const symbol of SYMBOLS) {
    try {
      const entry = data.RAW[symbol]?.["USD"];
      result[symbol] = extractPriceData(entry);

      if (!result[symbol]) {
        console.warn(`[prices] Could not extract price data for ${symbol}.`);
      }
    } catch (err) {
      console.error(`[prices] Unexpected error extracting ${symbol}:`, err);
      result[symbol] = null;
    }
  }

  return result;
}
