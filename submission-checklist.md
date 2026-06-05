# Aeco — Celopedia Submission Checklist

Every field required by the Celopedia submission form, filled and ready to paste.

| Field | Value |
|---|---|
| **Project name** | Aeco |
| **One-line description** | Autonomous AI sentiment oracle on Celo that posts hybrid Grok + Nansen sentiment scores on-chain every 2 hours and lets users predict the direction for AEC rewards. |
| **Live URL** | https://aeco-eight.vercel.app |
| **Network** | Celo Mainnet (chain ID 42220) |
| **Agent wallet** | `0x327D93521F470fAcA96b852d004c39DA33A45b45` |
| **ERC-8004 agent ID** | 9112 (Identity Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) |
| **Tracks entered** | AI Agents (primary) · DeFi / Oracles |

## Contract addresses (Celo Mainnet)

| Contract | Address |
|---|---|
| SentimentFeed | `0x0684191E2e8Ac149F0073875242af19eC08D0724` |
| HeartbeatOracle | `0x2199C72E411ed90fB10772259E3194791406EAd9` |
| PredictionGame | `0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC` |
| AECToken (AEC) | `0x4EbACf161bae6e52Ff52F12ab217c175f1D856D4` |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## Wallets

| Role | Address |
|---|---|
| Agent | `0x327D93521F470fAcA96b852d004c39DA33A45b45` |
| Deployer / Admin | `0x7191EAe87142DF900DBB2Cfec7b2674Bad109C4d` |

## Judge-facing summary (3 sentences) — what makes Aeco differentiated

Aeco is the only Celo oracle that fuses **social sentiment from Grok (live X + web search)** with **smart-money flow data from Nansen** into a single on-chain signal, surfacing a divergence flag whenever the crowd and the whales disagree. It runs fully autonomously — a heartbeat oracle proves liveness every cycle and the agent self-reports its own success rate and uptime to the **ERC-8004 Reputation Registry**, making its track record verifiable rather than self-claimed. On top of the feed, a permissionless PredictionGame turns the oracle into a game where anyone can stake reputation on sentiment direction and earn AEC, giving the data immediate, measurable utility for MiniPay's mobile users.

---

## Submission readiness

- [x] Project name
- [x] One-line description
- [x] Live URL
- [x] Contract addresses (all 4 core + 2 ERC-8004 registries)
- [x] Agent wallet
- [x] Tracks entered
- [x] 3-sentence judge-facing differentiation summary
