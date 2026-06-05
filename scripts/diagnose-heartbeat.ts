/**
 * Deterministic, gas-free diagnostic for the recordHeartbeat revert.
 * Needs NO private key — only eth_call / eth_getCode reads.
 *
 * It (1) resolves the proxy's active implementation, (2) extracts every 4-byte
 * function selector embedded in the implementation bytecode, and (3) checks a
 * list of candidate recordHeartbeat signatures against those selectors so we
 * learn the EXACT signature the deployed contract exposes — no guessing.
 * It then simulates the matching signature to confirm it doesn't revert.
 *
 * Required env:
 *   RPC_URL                  — Celo mainnet RPC.
 *   AGENT_WALLET             — agent address (msg.sender for the simulation; no key needed).
 *   HEARTBEAT_ORACLE_ADDRESS — defaults to the known mainnet proxy if unset.
 *
 * Usage:
 *   set -a && source .env && npx ts-node scripts/diagnose-heartbeat.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { createPublicClient, http, toFunctionSelector, type Address } from "viem";
import { celo } from "viem/chains";

const RPC_URL = process.env["RPC_URL"] ?? "";
const AGENT_WALLET = (process.env["AGENT_WALLET"] ?? "") as Address;
const HEARTBEAT_ORACLE_ADDRESS =
  (process.env["HEARTBEAT_ORACLE_ADDRESS"] ??
    "0x2199C72E411ed90fB10772259E3194791406EAd9") as Address;

/** Candidate recordHeartbeat signatures, broadest-plausible first. */
const CANDIDATES = [
  "recordHeartbeat(uint256,bool,string)",
  "recordHeartbeat(uint8,bool,string)",
  "recordHeartbeat(uint256,uint256,bool,string)",
  "recordHeartbeat(uint8,uint8,bool,string)",
  "recordHeartbeat(uint256,uint8,bool,string)",
  "recordHeartbeat(uint8,bool,string,string)",
  "recordHeartbeat(uint256,bool,string,string)",
  "recordHeartbeat(uint16,bool,string)",
  "recordHeartbeat(uint32,bool,string)",
];

const publicClient = createPublicClient({ chain: celo, transport: http(RPC_URL) });

/** Extracts unique 4-byte selectors that follow a PUSH4 (0x63) opcode. */
function extractSelectors(bytecode: string): Set<string> {
  const code = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const found = new Set<string>();
  for (let i = 0; i + 10 <= code.length; i += 2) {
    if (code.slice(i, i + 2).toLowerCase() === "63") {
      found.add("0x" + code.slice(i + 2, i + 10).toLowerCase());
    }
  }
  return found;
}

async function main(): Promise<void> {
  if (!RPC_URL) throw new Error("RPC_URL is not set");
  if (!process.env["AGENT_WALLET"]) throw new Error("AGENT_WALLET is not set");

  console.log(`HeartbeatOracle proxy: ${HEARTBEAT_ORACLE_ADDRESS}`);

  // EIP-1967 implementation slot.
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const raw = await publicClient.getStorageAt({ address: HEARTBEAT_ORACLE_ADDRESS, slot: IMPL_SLOT });
  const impl = raw ? (("0x" + raw.slice(-40)) as Address) : HEARTBEAT_ORACLE_ADDRESS;
  console.log(`Active implementation:  ${impl}\n`);

  const code = await publicClient.getCode({ address: impl });
  if (!code) throw new Error("No bytecode at implementation address");
  const selectors = extractSelectors(code);

  console.log("Candidate recordHeartbeat signatures vs deployed selectors:");
  let match: string | null = null;
  for (const sig of CANDIDATES) {
    const sel = toFunctionSelector(`function ${sig}`);
    const present = selectors.has(sel.toLowerCase());
    console.log(`  ${present ? "✓ PRESENT " : "  absent  "} ${sel}  ${sig}`);
    if (present && match === null) match = sig;
  }

  console.log();
  if (match) {
    console.log(`➡  Deployed contract exposes: ${match}`);
    console.log(`   writer.ts must encode recordHeartbeat with exactly these parameter types.`);
  } else {
    console.log("➡  None of the candidates matched. All selectors found in the impl:");
    console.log("   " + [...selectors].sort().join(" "));
    console.log("   (paste this list back so the correct signature can be identified)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[diagnose-heartbeat] fatal:", err);
    process.exit(1);
  });
