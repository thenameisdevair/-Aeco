# Aeco V2 PRD — Hybrid Sentiment Oracle + Sentiment-Resolved Prediction Markets

**Status:** Draft for review
**Date:** May 2026
**Supersedes:** V2_PRD.md (original)

---

## 0. What changed from the original V2 PRD

The original V2 PRD described a hybrid Grok + Nansen sentiment oracle with a generic prediction tab. This version makes three decisions the original left vague or wrong:

1. **Prediction markets resolve on sentiment, not price (Option B).** The bet is "will the market's read on this asset move up or down," not "will the price go up." The oracle is the referee.
2. **Resolution is anchored on Nansen netflow only — a hard, deterministic number.** Grok is display-only and never decides who wins money. This solves the LLM-determinism problem that would otherwise make sentiment-resolved markets unresolvable.
3. **Subjects split into two types.** Prediction-enabled subjects (tokens trackable by Nansen Smart Money) and display-only subjects (narratives, people, topics, and Celo-native assets Nansen can't track).

---

## 1. Product in one sentence

Aeco is a verifiable hybrid sentiment oracle on Celo: Grok-powered social sentiment displayed for humans, Nansen Smart Money flows powering deterministic on-chain sentiment-resolved prediction markets, and an x402 API selling structured sentiment and divergence signals to agents.

---

## 2. The two products

### Product 1 — The Oracle (display layer, all subjects)
Every 2 hours the agent posts a sentiment reading for each subject on-chain. For prediction-enabled subjects this is a composite (Grok + Nansen). For display-only subjects it is Grok-only. This is the V1 product, extended.

### Product 2 — Sentiment-Resolved Prediction Markets (Nansen-trackable subjects only)
A market opens around a subject. Users bet on the *direction the sentiment will move* over a fixed window. The market resolves on the **Nansen netflow direction** over that window — a hard number, independently verifiable, that cannot hallucinate or be re-rolled.

**Why netflow-only resolution:** Grok is an LLM. The same query can return 72 then 68. For a display score that variance is harmless. For a score that resolves money, a few points of LLM wobble could flip a market. Nansen's net smart-money flow over a window is a real dollar figure — deterministic, verifiable, defensible in a dispute. Grok never touches resolution.

---

## 3. Subject types

### Prediction-enabled subjects
Tokens with Nansen Smart Money netflow coverage. Resolution universe = native tokens and major assets on Nansen-supported chains.

- **Majors:** BTC, ETH, SOL
- **L2 tokens (Nansen Smart Money chains):** ARB (Arbitrum), OP (Optimism), and others on Base, Linea, Mantle, Scroll, Polygon, Sonic as coverage allows
- Each requires a verified token contract address on a Nansen-supported chain.

### Display-only subjects
No Nansen coverage. Grok-only sentiment. **No prediction markets.** Shown on the oracle dashboard with a clear "Social only" label.

- Celo-native assets (CELO, cUSD, cKES) — Celo is not a Nansen Smart Money chain
- Narratives / macro topics — Fed policy, rate decisions, stablecoin regulation, global economy news, Africa crypto adoption
- People — e.g. Vitalik (his stated views do not imply proportional on-chain investment, so wallet flows are not a valid sentiment proxy)

**UI requirement:** every subject card displays a badge — "Hybrid" (prediction-enabled) or "Social only" (display-only). No ambiguity about which scores resolve money.

---

## 4. The composite score (prediction-enabled subjects)

Display composite (what users see): tunable, starting point 60% Grok social + 30% Nansen netflow signal + 10% divergence factor.

**Resolution value (what settles bets): Nansen netflow direction only.** Independent of the display composite.

### Divergence — the premium signal
When Grok social and Nansen netflow disagree (social bullish, smart money exiting, or vice versa), that is the alpha. Nobody else computes it. Surfaced in the UI and sold as a premium x402 endpoint.

---

## 5. Prediction market mechanics

### Lifecycle
1. **Open:** A market is created for a prediction-enabled subject. An **open snapshot** of the Nansen netflow baseline is frozen on-chain with a timestamp.
2. **Betting window:** Users stake on UP or DOWN (sentiment direction).
3. **Close:** At `resolveAfterTimestamp`, a **close snapshot** of netflow is taken and frozen on-chain.
4. **Resolve:** Compare close vs open.

### Resolution rule
```
delta = close_netflow_signal - open_netflow_signal
if abs(delta) < THRESHOLD_POINTS:  -> VOID, all stakes returned
elif delta > 0:                    -> UP wins
else:                              -> DOWN wins
```

### Threshold
- **Unit: absolute points on the netflow-derived 0–100 signal scale.** NOT a percentage. (Percentage-of-score breaks on a bounded 0–100 scale: a 25% rise from 80 hits the ceiling; a 25% rise from 8 is noise.)
- **Default placeholder: 5 points. Configurable. Tune from backtesting.**
- Sub-threshold moves void and return stakes — protects users from betting on noise.

### Snapshots must be immutable
Open and close netflow values are written on-chain and never mutable. The resolution must be reproducible by any third party from on-chain data + Nansen's public API. This is the trust core of the product.

---

## 6. B2A — x402 API endpoints

Four endpoints. Three shippable now, one gated on persistence.

1. **Current sentiment** — `/sentiment/:subject` — cheap (~$0.01). Latest score, signal, confidence, provenance. Bread and butter.
2. **Divergence signal** — `/divergence/:subject` — premium. Cases where Grok and Nansen disagree. The alpha. Justifies premium price.
3. **Prediction market state** — `/markets` — medium. Open markets, current odds, time to resolution. Lets agents read and position. Ties the two products together.
4. **Historical sentiment** — `/history/:subject` — **BLOCKED on persistence.** SQLite resets every deploy (known gap). Cannot sell historical data that isn't durably stored. Gated until persistence is fixed.

**Not building:** a chat/synthesis endpoint for agents. Agents want structured data, not prose. Chat is B2C only. A natural-language agent endpoint is expensive (Grok call per request) and unparseable.

---

## 7. What changes in the current codebase

### Contracts
- **SentimentFeed (UUPS upgrade):** `SentimentRecord` struct currently has score/signal/confidence/summary/sourceType/timestamp/deltaFromLast/agentVersion. Add fields for the hybrid breakdown: `socialScore`, `nansenScore`, `divergenceFlag`. Requires a V2 implementation + upgrade tx. Storage-append only (UUPS-safe).
- **PredictionGame (UUPS upgrade or new contract):** Current `Prediction` struct resolves on `madeAtScore` vs current score with a fixed 24h `RESOLUTION_WINDOW` and AEC rewards. Option B needs: open/close netflow snapshots, the threshold-void logic, and netflow-based (not Grok-score-based) resolution. This is a significant rework — likely a new `PredictionMarketV2` contract rather than an in-place upgrade, since the resolution source changes fundamentally.
- **AECToken / HeartbeatOracle:** No structural change required for the core oracle. Staking/burn mechanics (PRD §8) are post-hackathon.

### Agent
- New `agent/nansen.ts` module — calls Smart Money Netflow endpoint (5 credits/call, Pro plan). Requires token contract addresses per prediction-enabled subject.
- `agent/index.ts` — extend the cycle: for prediction-enabled subjects, fetch netflow + compute composite; for display-only, Grok only (unchanged).
- `agent/writer.ts` — `postSentiment` ABI/call must include new fields after the contract upgrade.

### API
- `api/index.ts` — already scaffolded with x402 middleware. Implement the four endpoints above (three of them). Deploy to Railway/Render.

### Persistence (blocker)
- SQLite resets on deploy. Must move to durable storage before the historical endpoint and before any market needs to reference past snapshots beyond what's on-chain. Flag as a hard dependency.

---

## 8. Credit budget (Nansen, Pro plan)

- Netflow = 5 credits/call. Prediction-enabled subjects only.
- At ~5 prediction subjects × 12 cycles/day = ~300 credits/day → 50,000 credits ≈ 166 days runway.
- Adding more prediction subjects scales linearly. Top-up: $0.001/credit.
- Display-only subjects cost 0 Nansen credits (Grok only).

---

## 9. Hackathon alignment (Onchain Agents Hackathon, deadline Jun 15 2026)

Three tracks: Best Agent on Celo, Most On-chain Transactions, Highest 8004scan Rank.

- Current 8004scan: ~21.1 (peaked 33.9), 80+ feedbacks, 4.2/5.0 score. Strong reputation; the gap is **activity/transaction volume**, not reputation.
- Every prediction (bet + resolution) and every x402 paid call is an on-chain transaction. V2 features are the transaction-volume strategy.
- The agent posts feedback after agentic work to keep the reputation loop alive.

**Build priority is driven by transaction volume, with one dependency override:** because markets resolve on the composite/netflow signal, the Nansen integration is no longer optional garnish — it is a prerequisite for prediction markets. Order: composite score (Nansen) → snapshot mechanism → prediction market → x402 deploy.

---

## 10. Post-hackathon (not in scope for Jun 15)

- AEC staking, fee burn, governance
- Chat Oracle (B2C, zero on-chain tx — lower hackathon value)
- Alerts (MiniPay push, Telegram, email)
- Multi-chain publishing
- Prezenti Frontier Pool grant application (deadline Jun 30)
- Celo Agent Visa application (apply early — agent already has on-chain activity)

---

## 11. Open items to resolve before/during build

- Exact threshold value (default 5 points, tune from backtest)
- How the raw netflow dollar figure maps to a 0–100 signal (normalization function — rolling average across tracked tokens, deviation mapped to 0–100)
- Final list of L2 prediction subjects (confirm which have usable Nansen coverage)
- Persistence solution choice (Postgres? hosted SQLite? other)
- PredictionGame: in-place UUPS upgrade vs new V2 contract (leaning new contract)