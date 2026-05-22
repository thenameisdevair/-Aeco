/**
 * One-time script to register the Aeco agent on the ERC-8004 Identity Registry.
 *
 * Usage (with env already sourced):
 *   set -a && source .env && npx ts-node agent/registerAgent.ts
 *
 * The script will:
 *   1. Check if the agent is already registered and exit early if so.
 *   2. Print the agent card JSON for you to upload to IPFS.
 *   3. Prompt for the resulting IPFS URI.
 *   4. Submit the on-chain registration transaction.
 */

import * as readline from "readline";
import { getAgentId, registerAgent } from "./erc8004";

const AGENT_CARD = {
  type:        "Agent",
  name:        "Aeco Sentiment Oracle",
  description: "Autonomous AI agent posting real-time sentiment scores for crypto assets, people, and narratives on Celo Mainnet every 2 hours via Grok AI",
  version:     "2.0.0",
  endpoints: [
    { type: "wallet", address: "0x9600e1E61c5a412132f683b4DF591669Be7b1EE2", chainId: 42220 },
  ],
  supportedTrust: ["reputation"],
};

async function main(): Promise<void> {
  const existing = await getAgentId();
  if (existing !== null) {
    console.log(`Agent already registered with ID: ${existing}`);
    process.exit(0);
  }

  console.log("\nUpload the following JSON to IPFS (e.g. via pinata.cloud or nft.storage):\n");
  console.log(JSON.stringify(AGENT_CARD, null, 2));
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const uri = await new Promise<string>((resolve) => {
    rl.question(
      "Upload the above JSON to IPFS (e.g. via pinata.cloud or nft.storage) then paste the IPFS URI here: ",
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });

  const agentId = await registerAgent(uri);
  console.log(`Agent registered with ID: ${agentId}`);
  process.exit(0);
}

main();
