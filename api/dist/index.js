"use strict";
/**
 * Aeco oracle API server.
 *
 * Serves live sentiment data from Celo Mainnet contracts.
 * Paid routes are gated with x402 micropayments in cUSD via thirdweb.
 *
 * Free routes:  GET /health, GET /heartbeat, GET /sentiment/:subject (IDs 1–3)
 * Paid routes:  GET /sentiment/all ($0.05), GET /sentiment/:subject IDs 4–8 ($0.01)
 *
 * Required env: THIRDWEB_SECRET_KEY, PORT (optional, default 3000)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const thirdweb_1 = require("thirdweb");
const x402_1 = require("thirdweb/x402");
const chains_1 = require("thirdweb/chains");
const contracts_1 = require("./lib/contracts");
// ─────────────────────────────────────────────────────────────────────────────
// thirdweb x402 setup
// ─────────────────────────────────────────────────────────────────────────────
const thirdwebClient = (0, thirdweb_1.createThirdwebClient)({
    secretKey: process.env["THIRDWEB_SECRET_KEY"] ?? "",
});
const thirdwebFacilitator = (0, x402_1.facilitator)({
    client: thirdwebClient,
    serverWalletAddress: "0x9600e1E61c5a412132f683b4DF591669Be7b1EE2",
});
const AGENT_WALLET = "0x9600e1E61c5a412132f683b4DF591669Be7b1EE2";
// ─────────────────────────────────────────────────────────────────────────────
// Subject name → ID lookup
// ─────────────────────────────────────────────────────────────────────────────
const NAME_TO_ID = {
    celo: 1,
    cusd: 2,
    ckes: 3,
    btc: 4,
    eth: 5,
    vitalik: 6,
    stablecoin: 7,
    africa: 8,
};
/** Resolves a route :subject param (number string or name) to an on-chain ID. */
function resolveSubjectId(param) {
    const asNum = parseInt(param, 10);
    if (!isNaN(asNum) && asNum >= 1 && asNum <= 8)
        return asNum;
    const fromName = NAME_TO_ID[param.toLowerCase()];
    return fromName ?? null;
}
// ─────────────────────────────────────────────────────────────────────────────
// x402 payment helper
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Attempts to settle an x402 payment for a request.
 * Returns true if the payment cleared (caller should send the data).
 * Returns false after writing the 402/error response itself (caller should return).
 */
async function requirePayment(req, res, price) {
    const paymentData = (req.headers["payment-signature"] ?? req.headers["x-payment"]);
    const result = await (0, x402_1.settlePayment)({
        resourceUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        method: "GET",
        paymentData,
        payTo: AGENT_WALLET,
        network: chains_1.celo,
        price,
        facilitator: thirdwebFacilitator,
    });
    if (result.status === 200)
        return true;
    res.status(result.status).set(result.responseHeaders).json(result.responseBody);
    return false;
}
// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, _res, next) => {
    console.log(`[api] ${req.method} ${req.path}`);
    next();
});
// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        agent: "Aeco Sentiment Oracle",
        agentId: 9112,
        version: "2.0.0",
        timestamp: Date.now(),
    });
});
// ── GET /heartbeat ────────────────────────────────────────────────────────────
app.get("/heartbeat", async (_req, res) => {
    try {
        const heartbeats = await (0, contracts_1.getHeartbeats)(10);
        res.json({ heartbeats, count: heartbeats.length });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[api] /heartbeat error:", message);
        res.status(500).json({ error: message });
    }
});
// ── GET /sentiment/all ────────────────────────────────────────────────────────
app.get("/sentiment/all", async (req, res) => {
    try {
        const paid = await requirePayment(req, res, "$0.05");
        if (!paid)
            return;
        const subjects = await (0, contracts_1.getAllSentiment)();
        res.json({ subjects, count: subjects.length, updatedAt: new Date().toISOString() });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[api] /sentiment/all error:", message);
        res.status(500).json({ error: message });
    }
});
// ── GET /sentiment/:subject ───────────────────────────────────────────────────
app.get("/sentiment/:subject", async (req, res) => {
    try {
        const id = resolveSubjectId(String(req.params["subject"] ?? ""));
        if (id === null) {
            res.status(400).json({ error: "Unknown subject. Use an ID (1–8) or name (celo, btc, eth, cusd, ckes, vitalik, stablecoin, africa)." });
            return;
        }
        // IDs 4–8 require payment; IDs 1–3 (CELO, cUSD, cKES) are free.
        if (id >= 4) {
            const paid = await requirePayment(req, res, "$0.01");
            if (!paid)
                return;
        }
        const record = await (0, contracts_1.getSentiment)(id);
        if (record === null) {
            res.status(404).json({ error: `No on-chain record found for subject ${id}.` });
            return;
        }
        res.json(record);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[api] /sentiment/${req.params["subject"]} error:`, message);
        res.status(500).json({ error: message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
app.listen(PORT, () => {
    console.log(`[api] Aeco oracle API running on port ${PORT}`);
    console.log(`[api] Free:  GET /health, /heartbeat, /sentiment/1, /sentiment/2, /sentiment/3`);
    console.log(`[api] Paid:  GET /sentiment/all ($0.05), /sentiment/4..8 ($0.01 each)`);
});
process.stdin.resume();
setInterval(() => {}, 1000 * 60 * 60);
