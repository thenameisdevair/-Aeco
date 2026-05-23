/**
 * ERC-8004 Identity and Reputation registry interactions for the Aeco agent on Celo Mainnet.
 *
 * Contract addresses (Celo Mainnet):
 *   Identity Registry:   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 *   Reputation Registry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
 */

import { type Address } from "viem";
import { walletClient, publicClient, agentAccount } from "./writer";

// ─────────────────────────────────────────────────────────────────────────────
// Contract addresses
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ABIs
// ─────────────────────────────────────────────────────────────────────────────

const identityRegistryAbi = [
  {
    name:            "register",
    type:            "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "",         type: "uint256" }],
  },
  {
    name:            "balanceOf",
    type:            "function",
    stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }],
    outputs: [{ name: "",      type: "uint256" }],
  },
  {
    name:            "tokenOfOwnerByIndex",
    type:            "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the ERC-8004 token ID owned by the agent wallet from the Identity Registry.
 *
 * Checks balanceOf first to avoid reverting on tokenOfOwnerByIndex when no token
 * exists. Returns the token ID of the first (index 0) token if one is found.
 *
 * @returns The agent's ERC-8004 token ID, or null if not yet registered or on error.
 */
export async function getAgentId(): Promise<bigint | null> {
  try {
    const balance = await publicClient.readContract({
      address:      IDENTITY_REGISTRY,
      abi:          identityRegistryAbi,
      functionName: "balanceOf",
      args:         [agentAccount.address],
    });

    if (balance === 0n) {
      console.log("[erc8004] No agent registered yet");
      return null;
    }

    const tokenId = await publicClient.readContract({
      address:      IDENTITY_REGISTRY,
      abi:          identityRegistryAbi,
      functionName: "tokenOfOwnerByIndex",
      args:         [agentAccount.address, 0n],
    });

    console.log(`[erc8004] Agent already registered — tokenId: ${tokenId}`);
    return tokenId;
  } catch (err) {
    console.error("[erc8004] getAgentId failed:", err);
    return null;
  }
}

/**
 * Registers the Aeco agent on the ERC-8004 Identity Registry by minting an agent NFT.
 *
 * Parses the token ID from the first Transfer event in the transaction receipt.
 * Transfer(address indexed from, address indexed to, uint256 indexed tokenId) —
 * tokenId is the third indexed parameter, at topics[3] in the raw log.
 * Falls back to getAgentId() if the log is absent or malformed.
 *
 * @param agentURI - IPFS URI pointing to the agent card metadata JSON.
 * @returns The minted ERC-8004 token ID, or null on error.
 */
export async function registerAgent(agentURI: string): Promise<bigint | null> {
  console.log(`[erc8004] Registering agent with URI: ${agentURI}`);
  try {
    const txHash = await walletClient.writeContract({
      address:      IDENTITY_REGISTRY,
      abi:          identityRegistryAbi,
      functionName: "register",
      args:         [agentURI],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let tokenId: bigint | null = null;
    for (const log of receipt.logs) {
      if (log.topics.length >= 4 && log.topics[3]) {
        tokenId = BigInt(log.topics[3]);
        break;
      }
    }

    if (tokenId === null) {
      console.warn("[erc8004] Could not parse tokenId from receipt logs — falling back to getAgentId()");
      tokenId = await getAgentId();
    }

    console.log(`[erc8004] Agent registered — tokenId: ${tokenId} | tx: ${txHash}`);
    return tokenId;
  } catch (err) {
    console.error("[erc8004] registerAgent failed:", err);
    return null;
  }
}

