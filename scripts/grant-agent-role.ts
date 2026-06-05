/**
 * Grants AGENT_ROLE to the agent wallet on the mainnet SentimentFeed and
 * HeartbeatOracle contracts. Run this once if the agent's recordHeartbeat /
 * postSentiment calls revert with an AccessControl error — the symptom of the
 * configured PRIVATE_KEY_AGENT wallet not holding AGENT_ROLE.
 *
 * Must be run with the admin/deployer key (DEFAULT_ADMIN_ROLE holder).
 *
 * Required environment variables:
 *   RPC_URL                  — Celo mainnet JSON-RPC endpoint.
 *   PRIVATE_KEY_DEPLOYER     — admin wallet key (holds DEFAULT_ADMIN_ROLE).
 *   AGENT_WALLET             — address to grant AGENT_ROLE to (the agent wallet).
 *   SENTIMENT_FEED_ADDRESS   — defaults to the known mainnet proxy if unset.
 *   HEARTBEAT_ORACLE_ADDRESS — defaults to the known mainnet proxy if unset.
 *
 * Usage:
 *   set -a && source .env && npx ts-node scripts/grant-agent-role.ts
 */

import dotenv from "dotenv";
dotenv.config();

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const RPC_URL = process.env["RPC_URL"] ?? "";

const SENTIMENT_FEED_ADDRESS =
  (process.env["SENTIMENT_FEED_ADDRESS"] ??
    "0x0684191E2e8Ac149F0073875242af19eC08D0724") as Address;

const HEARTBEAT_ORACLE_ADDRESS =
  (process.env["HEARTBEAT_ORACLE_ADDRESS"] ??
    "0x2199C72E411ed90fB10772259E3194791406EAd9") as Address;

const AGENT_WALLET = (process.env["AGENT_WALLET"] ?? "") as Address;

const RAW_DEPLOYER_KEY = process.env["PRIVATE_KEY_DEPLOYER"] ?? "";
const DEPLOYER_PRIVATE_KEY = (
  RAW_DEPLOYER_KEY.startsWith("0x") ? RAW_DEPLOYER_KEY : `0x${RAW_DEPLOYER_KEY}`
) as `0x${string}`;

/** keccak256("AGENT_ROLE") — the role both contracts gate writes behind. */
const AGENT_ROLE = keccak256(toHex("AGENT_ROLE"));

const accessControlAbi = [
  {
    name: "hasRole",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "grantRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
] as const;

const transport = http(RPC_URL);
const publicClient = createPublicClient({ chain: celo, transport });
const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const walletClient = createWalletClient({ account: deployerAccount, chain: celo, transport });

async function grantOn(name: string, address: Address): Promise<void> {
  const already = await publicClient.readContract({
    address,
    abi: accessControlAbi,
    functionName: "hasRole",
    args: [AGENT_ROLE, AGENT_WALLET],
  });

  if (already) {
    console.log(`✓ ${name}: agent already has AGENT_ROLE — nothing to do.`);
    return;
  }

  const txHash = await walletClient.writeContract({
    address,
    abi: accessControlAbi,
    functionName: "grantRole",
    maxFeePerGas: 2_000_000_000_000n,
    maxPriorityFeePerGas: 2_000_000_000_000n,
    args: [AGENT_ROLE, AGENT_WALLET],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`→ ${name}: grantRole tx ${txHash} | status ${receipt.status}`);
}

async function main(): Promise<void> {
  if (!RPC_URL) throw new Error("RPC_URL is not set");
  if (RAW_DEPLOYER_KEY === "") throw new Error("PRIVATE_KEY_DEPLOYER is not set");
  if (!process.env["AGENT_WALLET"]) throw new Error("AGENT_WALLET is not set");

  console.log(`Granting AGENT_ROLE to ${AGENT_WALLET}`);
  console.log(`  admin (caller): ${deployerAccount.address}\n`);

  await grantOn("SentimentFeed", SENTIMENT_FEED_ADDRESS);
  await grantOn("HeartbeatOracle", HEARTBEAT_ORACLE_ADDRESS);

  console.log("\n✓ Done. Re-run the agent — recordHeartbeat/postSentiment should now succeed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[grant-agent-role] fatal:", err);
    process.exit(1);
  });
