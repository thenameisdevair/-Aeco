/**
 * Aeco oracle API server.
 *
 * Serves live sentiment data from Celo Mainnet contracts.
 * Paid routes are gated with x402 micropayments in cUSD via the public facilitator.
 *
 * Free routes:  GET /health, GET /heartbeat, GET /sentiment/:subject (IDs 1–3)
 * Paid routes:  GET /sentiment/all ($0.05), GET /sentiment/:subject IDs 4–8 ($0.01)
 *
 * Required env: PORT (optional, default 3000)
 */

import "dotenv/config";
import express, {
  type Request,
  type Response,
} from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { getSentiment, getAllSentiment, getHeartbeats, getDivergence } from "./lib/contracts";
import { handleFaucet } from "./faucet";

// ─────────────────────────────────────────────────────────────────────────────
// x402 setup
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_WALLET = "0x9600e1E61c5a412132f683b4DF591669Be7b1EE2" as const;

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.xpay.sh",
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:*", new ExactEvmScheme());

const PAID_ACCEPTS = {
  scheme:  "exact",
  network: "eip155:8453",
  payTo:   AGENT_WALLET,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Subject name → ID lookup
// ─────────────────────────────────────────────────────────────────────────────

const NAME_TO_ID: Record<string, number> = {
  celo:       1,
  cusd:       2,
  ckes:       3,
  btc:        4,
  eth:        5,
  vitalik:    6,
  stablecoin: 7,
  africa:     8,
  sol:        9,
};

/** Resolves a route :subject param (number string or name) to an on-chain ID. */
function resolveSubjectId(param: string): number | null {
  const asNum = parseInt(param, 10);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 9) return asNum;

  const fromName = NAME_TO_ID[param.toLowerCase()];
  return fromName ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// Trust proxy for correct IP detection on Render
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// ── IP rate limiter — 1 faucet claim per IP per 24 hours ─────────────────────

const faucetLimiter = rateLimit({
  windowMs:       24 * 60 * 60 * 1000,
  max:            1,
  message:        { error: 'Already claimed from this IP today. Try again in 24 hours.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── POST /faucet ──────────────────────────────────────────────────────────────

app.post('/faucet', faucetLimiter, handleFaucet);

// ── GET /demo — free info ─────────────────────────────────────────────────────

app.get("/demo", (_req: Request, res: Response) => {
  res.json({
    message:  "x402 demo endpoint — pay $0.001 USDC on Base Sepolia to access sentiment data",
    network:  "Base Sepolia (eip155:84532)",
    price:    "$0.001 USDC",
    endpoint: "GET /demo/sentiment/:subject",
    subjects: "1-8 or name (celo, btc, eth, cusd, ckes, vitalik, stablecoin, africa)",
    docs:     "https://docs.x402.org",
  });
});

// ── GET /demo/sentiment/:subject — manual 402 flow, $0.001 USDC Base Sepolia ──

app.get("/demo/sentiment/:subject", async (req: Request, res: Response) => {
  try {
    const paymentHeader = req.headers["x-payment"] ?? req.headers["payment-signature"];

    if (!paymentHeader) {
      res.status(402).json({
        x402Version: 1,
        accepts: [{
          scheme:            "exact",
          network:           "eip155:84532",
          maxAmountRequired: "1000",
          resource:          `${req.protocol}://${req.get("host")}${req.originalUrl}`,
          description:       "Aeco sentiment oracle — Base Sepolia demo",
          mimeType:          "application/json",
          payTo:             AGENT_WALLET,
          maxTimeoutSeconds: 60,
          asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          extra:             {},
        }],
        error: "Payment required",
      });
      return;
    }

    const id = resolveSubjectId(String(req.params["subject"] ?? ""));
    if (id === null) {
      res.status(400).json({
        error: "Unknown subject. Use an ID (1–8) or name (celo, btc, eth, cusd, ckes, vitalik, stablecoin, africa).",
      });
      return;
    }

    const record = await getSentiment(id);
    if (record === null) {
      res.status(404).json({ error: `No on-chain record found for subject ${id}.` });
      return;
    }

    res.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api] /demo/sentiment/${req.params["subject"]} error:`, message);
    res.status(500).json({ error: message });
  }
});

app.use(
  paymentMiddleware(
    {
      "GET /sentiment/all": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.05" },
        description: "All 9 sentiment subjects — Aeco hybrid oracle",
      },
      "GET /sentiment/4": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.01" },
        description: "BTC hybrid sentiment (Grok + Nansen)",
      },
      "GET /sentiment/5": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.01" },
        description: "ETH hybrid sentiment (Grok + Nansen)",
      },
      "GET /sentiment/6": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.01" },
        description: "Vitalik Buterin sentiment",
      },
      "GET /sentiment/7": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.01" },
        description: "Stablecoin Regulation sentiment",
      },
      "GET /sentiment/8": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.01" },
        description: "Africa Crypto Adoption sentiment",
      },
      "GET /sentiment/9": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.01" },
        description: "SOL hybrid sentiment (Grok + Nansen)",
      },
      "GET /divergence": {
        accepts:     { ...PAID_ACCEPTS, price: "$0.02" },
        description: "Subjects where social and Smart Money disagree",
      },
    },
    resourceServer,
    undefined,
    undefined,
    false,
  )
);

app.use((req, _res, next) => {
  console.log(`[api] ${req.method} ${req.path}`);
  next();
});

// ── GET /health ───────────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status:         "ok",
    agent:          "Aeco Sentiment Oracle",
    agentId:        9112,
    version:        "2.0.0",
    subjects:       9,
    facilitator:    "Coinbase x402.org",
    paymentNetwork: "Base mainnet (eip155:8453)",
    dataNetwork:    "Celo mainnet (eip155:42220)",
    timestamp:      Date.now(),
  });
});

// ── Well-known discovery endpoints ───────────────────────────────────────────
// 8004scan pings these to verify agent service health

app.get("/.well-known/agent-card.json", (_req: Request, res: Response) => {
  res.json({
    "@context":   "https://schema.org",
    "@type":      "SoftwareAgent",
    "name":       "Aeco Sentiment Oracle",
    "version":    "2.0.0",
    "description": "Autonomous AI agent posting real-time hybrid sentiment scores (Grok AI + Nansen Smart Money flows) for 9 crypto assets on Celo Mainnet every 2 hours.",
    "url":        "https://aeco-eight.vercel.app",
    "provider": {
      "@type": "Organization",
      "name":  "Aeco"
    },
    "protocol":   "A2A",
    "protocolVersion": "0.3.0",
    "capabilities": [
      "sentiment-oracle",
      "prediction-markets",
      "hybrid-scoring",
      "x402-payments"
    ],
    "endpoint":   "https://aeco.onrender.com",
    "agentId":    9112,
    "agentRegistry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    "chainId":    42220,
    "status":     "active"
  });
});

app.get("/.well-known/mcp.json", (_req: Request, res: Response) => {
  res.json({
    "name":        "Aeco Sentiment Oracle",
    "version":     "2.0.0",
    "description": "MCP server exposing Aeco sentiment oracle data for crypto assets, people, and narratives on Celo Mainnet.",
    "protocol":    "MCP",
    "protocolVersion": "2025-06-18",
    "endpoint":    "https://aeco.onrender.com",
    "tools": [
      {
        "name":        "get_sentiment",
        "description": "Get the latest sentiment score for a subject (1-9)",
        "endpoint":    "https://aeco.onrender.com/sentiment/{subjectId}",
        "method":      "GET",
        "payment":     "x402",
        "price":       "$0.01 USDC on Base (subjects 4-9)"
      },
      {
        "name":        "get_all_sentiment",
        "description": "Get sentiment scores for all 9 subjects",
        "endpoint":    "https://aeco.onrender.com/sentiment/all",
        "method":      "GET",
        "payment":     "x402",
        "price":       "$0.05 USDC on Base"
      },
      {
        "name":        "get_divergence",
        "description": "Get subjects where social sentiment and Nansen Smart Money flows diverge",
        "endpoint":    "https://aeco.onrender.com/divergence",
        "method":      "GET",
        "payment":     "x402",
        "price":       "$0.02 USDC on Base"
      },
      {
        "name":        "get_heartbeat",
        "description": "Get agent heartbeat and operational status",
        "endpoint":    "https://aeco.onrender.com/heartbeat",
        "method":      "GET",
        "payment":     "free"
      }
    ],
    "agentId":       9112,
    "agentRegistry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    "status":        "active"
  });
});

app.get("/.well-known/oasf.json", (_req: Request, res: Response) => {
  res.json({
    "version": "0.8.0",
    "skills": [
      "natural_language_processing/information_retrieval_synthesis/search",
      "tool_interaction/api_schema_understanding",
      "tool_interaction/workflow_automation",
      "data_analysis/time_series_analysis",
      "data_analysis/quantitative_analysis"
    ],
    "domains": [
      "technology/blockchain",
      "finance_and_business/finance",
      "finance_and_business/trading_and_investment"
    ],
    "agent": {
      "id":       9112,
      "name":     "Aeco Sentiment Oracle",
      "registry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  });
});

// ── GET /heartbeat ────────────────────────────────────────────────────────────

app.get("/heartbeat", async (_req: Request, res: Response) => {
  try {
    const heartbeats = await getHeartbeats(10);
    res.json({ heartbeats, count: heartbeats.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api] /heartbeat error:", message);
    res.status(500).json({ error: message });
  }
});

// ── GET /sentiment/all — $0.05 ────────────────────────────────────────────────

app.get("/sentiment/all", async (_req: Request, res: Response) => {
  try {
    const subjects = await getAllSentiment();
    res.json({ subjects, count: subjects.length, updatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api] /sentiment/all error:", message);
    res.status(500).json({ error: message });
  }
});

// ── GET /divergence — premium divergence signal, $0.02 ───────────────────────
app.get("/divergence", async (_req: Request, res: Response) => {
  try {
    const divergent = await getDivergence();
    res.json({
      divergent,
      count:     divergent.length,
      updatedAt: new Date().toISOString(),
      note:      "Subjects where Grok social signal and Nansen Smart Money flow disagree.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api] /divergence error:", message);
    res.status(500).json({ error: message });
  }
});

// ── GET /sentiment/:subject — free for IDs 1–3, $0.01 for IDs 4–8 ────────────

app.get("/sentiment/:subject", async (req: Request, res: Response) => {
  try {
    const id = resolveSubjectId(String(req.params["subject"] ?? ""));
    if (id === null) {
      res.status(400).json({
        error: "Unknown subject. Use an ID (1–8) or name (celo, btc, eth, cusd, ckes, vitalik, stablecoin, africa).",
      });
      return;
    }

    const record = await getSentiment(id);
    if (record === null) {
      res.status(404).json({ error: `No on-chain record found for subject ${id}.` });
      return;
    }

    res.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api] /sentiment/${req.params["subject"]} error:`, message);
    res.status(500).json({ error: message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

(async () => {
  await resourceServer.initialize();
  console.log(`[api] x402 facilitator: Coinbase | network: Base eip155:8453 | payTo: ${AGENT_WALLET}`);

  app.listen(PORT, () => {
    console.log(`[api] Aeco oracle API running on port ${PORT}`);
    console.log(`[api] Free:  GET /health, /heartbeat, /sentiment/1, /sentiment/2, /sentiment/3`);
    console.log(`[api] Paid:  GET /sentiment/all ($0.05), /sentiment/4..9 ($0.01), /divergence ($0.02)`);
    console.log(`[api] Demo:  GET /demo/sentiment/:subject ($0.001 USDC on Base Sepolia)`);
  });

  // Keep event loop alive
  process.stdin.resume();
})();
