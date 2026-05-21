# Aeco — AI Sentiment Oracle on Celo

Aeco is an autonomous AI agent that monitors real-time sentiment across crypto assets, influential people, and emerging narratives — and posts scored sentiment data on-chain every 2 hours to Celo Mainnet.

Users can make predictions on sentiment direction and earn AEC tokens for being correct.

**Live:** https://aeco-eight.vercel.app  
**Network:** Celo Mainnet  
**MiniPay:** Open the link inside MiniPay to auto-connect

---

## How It Works

1. **Grok AI agent** scans X posts, news, and price data for 8 tracked subjects every 2 hours
2. **Sentiment scores** (0–100) are posted on-chain to the SentimentFeed contract
3. **Anyone can view** live scores on the dashboard or consume oracle data directly from the contract
4. **Users predict** whether a sentiment score will be higher or lower in 24 hours
5. **Correct predictions** earn 10 AEC tokens (20 AEC with a streak of 5+)

---

## Tracked Subjects

| Subject | Category |
|---|---|
| CELO | Asset |
| cUSD | Asset |
| cKES | Asset |
| BTC | Asset |
| ETH | Asset |
| Vitalik Buterin | Person |
| Stablecoin Regulation | Narrative |
| Africa Crypto Adoption | Narrative |

---

## Smart Contracts (Celo Mainnet)

| Contract | Address |
|---|---|
| SentimentFeed | `0x0684191E2e8Ac149F0073875242af19eC08D0724` |
| HeartbeatOracle | `0x2199C72E411ed90fB10772259E3194791406EAd9` |
| PredictionGame | `0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC` |
| AECToken (AEC) | `0x4EbACf161bae6e52Ff52F12ab217c175f1D856D4` |

All contracts are UUPS upgradeable and verified on [Celoscan](https://celoscan.io).

---

## Architecture

```
Grok API (xAI)          CryptoCompare
│                       │
└──────────┬────────────┘
           │
      agent/index.ts
  (runs every 2h via GitHub Actions)
           │
    ┌──────┴────────┐
    │               │
HeartbeatOracle  SentimentFeed
(liveness proof) (sentiment data)
                     │
               PredictionGame
               (user predictions)
                     │
                 AECToken
               (rewards, ERC-20)
                     │
                 Frontend
          (aeco-eight.vercel.app)
```

---

## Repository Structure

```
contracts/        Foundry smart contracts (Solidity)
  src/            AECToken, HeartbeatOracle, SentimentFeed, PredictionGame
  script/         Deploy.s.sol, Seed.s.sol
agent/            Autonomous agent (TypeScript)
  index.ts        Orchestrator — runs one cycle and exits
  grok.ts         xAI Grok API client (OpenAI SDK)
  writer.ts       Viem-based contract writer
  prices.ts       CryptoCompare price fetcher
  prompts/        Separate prompt templates per category
app/              Frontend (React via CDN, no build step)
  index.html      Desktop dashboard
  app.jsx         Main app component
  data-live.js    Live contract reads via viem
  components.jsx  UI components
.github/
  workflows/
    agent.yml     Cron job — runs agent every 2 hours
```

---

## Running the Agent Locally

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Fill in: GROK_API_KEY, PRIVATE_KEY_AGENT, AGENT_WALLET,
#          RPC_URL, SENTIMENT_FEED_ADDRESS, HEARTBEAT_ORACLE_ADDRESS

# Run one cycle
npm run agent
```

---

## Deploying Contracts

```bash
cd contracts
npm install  # installs OpenZeppelin

# Deploy to Celo Sepolia testnet
forge script script/Deploy.s.sol --rpc-url celo_testnet --broadcast --verify

# Seed subjects after deployment
forge script script/Seed.s.sol --rpc-url celo_testnet --broadcast

# Deploy to Celo Mainnet
forge script script/Deploy.s.sol --rpc-url celo_mainnet --broadcast --verify
```

---

## Token: AEC

- **Name:** AIOracle
- **Symbol:** AEC
- **Max Supply:** 100,000,000
- **Minting:** Controlled by PredictionGame (rewards) and agent wallet
- **Network:** Celo Mainnet

---

## Built With

- [Celo](https://celo.org) — L2 blockchain optimized for mobile and payments
- [MiniPay](https://minipay.opera.com) — Mobile wallet with 10M+ users
- [Grok / xAI](https://x.ai) — Real-time X search and web search for sentiment
- [Foundry](https://getfoundry.sh) — Smart contract development
- [OpenZeppelin](https://openzeppelin.com) — UUPS upgradeable contract libraries
- [viem](https://viem.sh) — TypeScript Ethereum client
- [GitHub Actions](https://github.com/features/actions) — Agent automation

---

## License

MIT
