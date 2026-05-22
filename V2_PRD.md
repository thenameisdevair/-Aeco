# Aeco v2 — PRD
## ERC-8004 Agent Identity + x402 Paid Oracle API

**Status:** Planning  
**Target:** Onchain Agents Hackathon (June 15, 2026) + Prezenti Frontier Pool (June 30, 2026)  
**Current version:** https://aeco-eight.vercel.app  
**Repo:** https://github.com/thenameisdevair/-Aeco

---

## Context

Aeco v1 is a live AI sentiment oracle on Celo Mainnet. An autonomous agent powered by Grok (xAI) scans 8 subjects every 2 hours, posts sentiment scores on-chain, and lets users make predictions to earn AEC tokens.

V1 is a consumer product. V2 makes it infrastructure.

Two additions achieve this:
1. **ERC-8004** — gives the Aeco agent a verifiable on-chain identity and reputation score tracked at 8004scan.io
2. **x402** — exposes oracle data as a paid HTTP endpoint so other AI agents can consume it autonomously

---

## Current Architecture (v1)
Grok API (xAI) + CryptoCompare
│
agent/index.ts (GitHub Actions, every 2h)
│
┌────┴─────┐
│          │
HeartbeatOracle  SentimentFeed
│
PredictionGame
│
AECToken (ERC-20)
│
aeco-eight.vercel.app

**Contracts (Celo Mainnet):**
- SentimentFeed: `0x0684191E2e8Ac149F0073875242af19eC08D0724`
- HeartbeatOracle: `0x2199C72E411ed90fB10772259E3194791406EAd9`
- PredictionGame: `0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC`
- AECToken: `0x4EbACf161bae6e52Ff52F12ab217c175f1D856D4`

**Agent wallet:** `0x9600e1E61c5a412132f683b4DF591669Be7b1EE2`  
**Agent cycle:** Every 2 hours via GitHub Actions  
**Daily transactions:** ~108 mainnet writes

---

## V2 Goals

1. Register Aeco agent on ERC-8004 to establish on-chain identity and climb 8004scan.io leaderboard
2. Build an x402-gated HTTP API that returns live sentiment data from SentimentFeed
3. Update the agent to submit reputation scores after each oracle post
4. Update the frontend Agent tab to show ERC-8004 rank and x402 endpoint docs
5. Submit to Onchain Agents Hackathon and apply for Prezenti Frontier Pool grant

---

## Feature 1: ERC-8004 Agent Registration

### What is ERC-8004
ERC-8004 is Ethereum's trust standard for autonomous AI agents. It defines three on-chain registries:
- **Identity Registry** — who the agent is, what it does, its service endpoint
- **Reputation Registry** — track record of completed tasks, scored by peers
- **Validation Registry** — cryptographic proofs of agent computation

Celo deployed ERC-8004 in February 2026. All registered agents are tracked at 8004scan.io.

### What we build

**Step 1 — Deploy Agent Card**
Register Aeco's agent on the ERC-8004 Identity Registry on Celo Mainnet.

Agent Card fields:
- name: "Aeco Sentiment Oracle"
- description: "Autonomous AI agent that posts real-time sentiment scores for crypto assets, people, and narratives on Celo Mainnet every 2 hours"
- version: "2.0.0"
- serviceEndpoint: "https://api.aeco.xyz/sentiment" (x402 endpoint, built in Feature 2)
- capabilities: ["sentiment-oracle", "prediction-resolution", "on-chain-data"]
- wallet: agent wallet address

**Step 2 — Reputation updates**
After each oracle post cycle, the agent submits a reputation update to the ERC-8004 Reputation Registry:
- task: "sentiment_post"
- subjectsPosted: number
- cycleTimestamp: block timestamp
- contractAddress: SentimentFeed address

This runs inside agent/index.ts after recordHeartbeat(), adding one reputation write per cycle.

**Step 3 — Frontend integration**
In the Agent tab, add a new stats row showing:
- ERC-8004 Agent ID (the on-chain registration ID)
- Current 8004scan rank
- Link to the agent's 8004scan.io profile page

### Files to create/modify
- `contracts/src/AgentRegistry.sol` — interface only, for interacting with the deployed ERC-8004 registry
- `agent/erc8004.ts` — registration and reputation submission functions
- `agent/index.ts` — call submitReputation() after recordHeartbeat()
- `app/app.jsx` — add ERC-8004 stats to AgentScreen

### Research required before building
- Read ERC-8004 spec and find the deployed registry contract address on Celo Mainnet
- Check 8004scan.io for the exact registration ABI
- Confirm whether reputation submissions require a fee

---

## Feature 2: x402 Paid Oracle API

### What is x402
x402 is an HTTP payment protocol that revives the HTTP 402 "Payment Required" status code for stablecoin micropayments. When a client requests a resource:
1. Server returns `402 Payment Required` with payment details (amount, token, recipient)
2. Client pays in cUSD via the thirdweb x402 facilitator
3. Client re-sends request with payment proof in header
4. Server validates payment and returns the data

No API keys. No accounts. Agents pay autonomously.

### What we build

**New service: `api/` directory**

A lightweight Node.js/Express server deployed separately (Railway or Render free tier) that:

Endpoints:

`GET /sentiment/:subject`
- Returns latest sentiment record for a subject from SentimentFeed contract
- Protected by x402 — price: $0.01 cUSD per request
- Free tier: subject ID 1-3 (CELO, cUSD, cKES) — no payment required
- Paid tier: subject ID 4-8 (BTC, ETH, Vitalik, narratives) — $0.01 cUSD

`GET /sentiment/all`
- Returns all 8 subjects latest records
- Price: $0.05 cUSD per request

`GET /heartbeat`
- Returns last 10 heartbeats from HeartbeatOracle
- Free — no payment required (proof the oracle is alive)

`GET /health`
- Returns service status, agent wallet balance, last cycle timestamp
- Free

Response format for /sentiment/:subject:
```json
{
  "subject": "CELO",
  "category": "ASSET",
  "score": 58,
  "signal": "neutral",
  "confidence": 40,
  "summary": "Slight positive mentions in recent posts.",
  "timestamp": 1716246394,
  "updatedAt": "2026-05-21T11:06:34.000Z"
}
```

**x402 middleware**
Use thirdweb's x402 server SDK to gate paid endpoints:
- Payment token: cUSD on Celo Mainnet (`0x765DE816845861e75A25fCA122bb6898B8B1282a`)
- Facilitator: thirdweb's Celo facilitator address
- Recipient: agent wallet (`0x9600e1E61c5a412132f683b4DF591669Be7b1EE2`)

**Frontend documentation**
In the Agent tab, add a new "Developer API" section showing:
- Base URL of the x402 endpoint
- Example curl command showing the 402 flow
- Supported endpoints and prices
- Link to thirdweb x402 docs for how to pay from an agent

### Files to create
- `api/index.ts` — Express server entry point
- `api/routes/sentiment.ts` — sentiment endpoint logic
- `api/routes/heartbeat.ts` — heartbeat endpoint
- `api/middleware/x402.ts` — payment gating middleware
- `api/lib/contracts.ts` — viem client for reading SentimentFeed and HeartbeatOracle
- `api/package.json` — separate package.json for the API service
- `.github/workflows/api.yml` — deploy API on push (or manual)
- `app/app.jsx` — add Developer API section to AgentScreen

---

## Feature 3: Additional Subjects

Add 2 new subjects to SentimentFeed to increase oracle coverage and on-chain activity:

| ID | Name | Category |
|---|---|---|
| 9 | Donald Trump | Person |
| 10 | DeFi Narrative | Narrative |

Steps:
- Call addSubject() on SentimentFeed from deployer wallet for each new subject
- Add to SUBJECTS array in agent/index.ts
- Add mock entries to app/data.jsx
- No contract upgrade needed

---

## Build Order

| Phase | Feature | Effort | Deadline |
|---|---|---|---|
| 1 | ERC-8004 registration (Steps 1-2) | 1 day | ASAP |
| 2 | x402 API server (core endpoints) | 2 days | Jun 10 |
| 3 | Additional subjects | 2 hours | Jun 10 |
| 4 | Frontend updates (ERC-8004 rank + API docs) | 1 day | Jun 12 |
| 5 | Prezenti Frontier Pool application | 2 hours | Jun 30 |
| 6 | Celo Builder Fund application | 2 hours | Rolling |

---

## Hackathon Alignment

**Onchain Agents Hackathon prizes Aeco targets:**

| Prize | Amount | How |
|---|---|---|
| Best Agent on Celo | $3,000 + $1,000 | Autonomous agent + x402 + ERC-8004 |
| Most Transactions | $500 | ~108 tx/day already, growing with reputation writes |
| Highest 8004scan Rank | $500 | ERC-8004 registration + reputation updates every cycle |

**Prezenti Frontier Pool ($25k grant)**
Aeco qualifies as agent economy infrastructure — a public on-chain oracle with a paid x402 API that other builders and agents can consume. The grant application should emphasize:
- Live mainnet deployment with real transaction volume
- x402 endpoint enabling agent-to-agent data consumption
- ERC-8004 registered agent with growing reputation
- Open source, no API key required

---

## Open Questions

1. What is the exact ERC-8004 registry contract address on Celo Mainnet? (check 8004scan.io or docs.celo.org)
2. Does the x402 thirdweb facilitator work on Celo Mainnet today, or only testnet?
3. What domain do we use for the x402 API endpoint? (options: api.aeco.xyz, aeco-api.vercel.app, or Railway URL)
4. Should reputation submissions happen every cycle or only when sentiment actually changed?

---

## Success Metrics

- ERC-8004 agent registered and visible on 8004scan.io
- x402 endpoint live and returning real data for $0.01 cUSD
- At least one successful agent-to-agent payment on the endpoint
- 8004scan rank in top 20
- Prezenti application submitted before June 30
