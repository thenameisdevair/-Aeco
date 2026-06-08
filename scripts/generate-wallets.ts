/**
 * Generates N fresh wallets and writes them to scripts/wallets.json.
 * Run once, then fund the addresses manually before running simulate-predictions.
 *
 * Usage: npx ts-node scripts/generate-wallets.ts [count]
 * Default count: 10
 *
 * OUTPUT: scripts/wallets.json — NEVER COMMIT THIS FILE.
 */
import * as fs   from "fs";
import * as path from "path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const count = parseInt(process.argv[2] ?? "10", 10);

const wallets = Array.from({ length: count }, (_, i) => {
  const privateKey = generatePrivateKey();
  const account    = privateKeyToAccount(privateKey);
  return {
    index:      i + 1,
    address:    account.address,
    privateKey,
  };
});

const outPath = path.join(__dirname, "wallets.json");
fs.writeFileSync(outPath, JSON.stringify(wallets, null, 2));

console.log(`\n✓ Generated ${count} wallets → ${outPath}\n`);
console.log("Fund these addresses before running simulate-predictions:\n");
wallets.forEach(w => console.log(`  [${w.index}] ${w.address}`));
console.log(`\n⚠  Never commit wallets.json — contains private keys.\n`);
