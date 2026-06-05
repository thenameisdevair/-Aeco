/**
 * Read-only diagnostic for the recordHeartbeat revert. Costs no gas — uses
 * eth_call (simulateContract) only, so it needs NO private key.
 *
 * It simulates recordHeartbeat against the deployed HeartbeatOracle using two
 * candidate signatures and reports which selector the contract actually accepts:
 *   A) recordHeartbeat(uint256 subjectsScanned, bool, string)  ← what writer.ts sends now
 *   B) recordHeartbeat(uint8  scanned,          bool, string)  ← matches getHistory's uint8 field
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

import { createPublicClient, http, type Address } from "viem";
import { celo } from "viem/chains";

const RPC_URL = process.env["RPC_URL"] ?? "";
const AGENT_WALLET = (process.env["AGENT_WALLET"] ?? "") as Address;
const HEARTBEAT_ORACLE_ADDRESS =
  (process.env["HEARTBEAT_ORACLE_ADDRESS"] ??
    "0x2199C72E411ed90fB10772259E3194791406EAd9") as Address;

const abiUint256 = [
  {
    name: "recordHeartbeat",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subjectsScanned", type: "uint256" },
      { name: "significantChange", type: "bool" },
      { name: "statusMessage", type: "string" },
    ],
    outputs: [],
  },
] as const;

const abiUint8 = [
  {
    name: "recordHeartbeat",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "scanned", type: "uint8" },
      { name: "anyPosted", type: "bool" },
      { name: "version", type: "string" },
    ],
    outputs: [],
  },
] as const;

const publicClient = createPublicClient({ chain: celo, transport: http(RPC_URL) });

async function probe(label: string, abi: typeof abiUint256 | typeof abiUint8, scanned: bigint | number): Promise<void> {
  try {
    await publicClient.simulateContract({
      address: HEARTBEAT_ORACLE_ADDRESS,
      abi: abi as typeof abiUint256,
      functionName: "recordHeartbeat",
      account: AGENT_WALLET,
      args: [scanned as bigint, true, "diagnostic probe"],
    });
    console.log(`✓ ${label}: SIMULATION SUCCEEDED — this selector is the correct one.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    console.log(`✗ ${label}: reverted — ${msg}`);
  }
}

async function main(): Promise<void> {
  if (!RPC_URL) throw new Error("RPC_URL is not set");
  if (!process.env["AGENT_WALLET"]) throw new Error("AGENT_WALLET is not set");

  console.log(`HeartbeatOracle: ${HEARTBEAT_ORACLE_ADDRESS}`);
  console.log(`Simulating as agent: ${AGENT_WALLET}\n`);

  // EIP-1967 implementation slot — shows which impl the proxy delegates to.
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const raw = await publicClient.getStorageAt({ address: HEARTBEAT_ORACLE_ADDRESS, slot: IMPL_SLOT });
  if (raw) console.log(`Active implementation: 0x${raw.slice(-40)}\n`);

  await probe("A) recordHeartbeat(uint256,bool,string)  [current writer.ts]", abiUint256, 9n);
  await probe("B) recordHeartbeat(uint8,bool,string)     [matches getHistory]", abiUint8, 9);

  console.log("\nThe variant that SUCCEEDED is the signature writer.ts must use.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[diagnose-heartbeat] fatal:", err);
    process.exit(1);
  });
