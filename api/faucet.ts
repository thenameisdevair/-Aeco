import { createWalletClient, createPublicClient, http, parseEther, isAddress } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

const CLAIMS_FILE   = path.join(__dirname, 'faucet-claims.json');
const FAUCET_AMOUNT = parseEther('0.1');
const MIN_BALANCE   = parseEther('1');

const account = privateKeyToAccount(
  (process.env.PRIVATE_KEY_AGENT || '') as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: celo,
  transport: http(process.env.RPC_URL!)
});

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.RPC_URL!)
});

function loadClaims(): Record<string, number> {
  try {
    if (!fs.existsSync(CLAIMS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CLAIMS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveClaim(wallet: string): void {
  const claims = loadClaims();
  claims[wallet.toLowerCase()] = Date.now();
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2));
}

function hasClaimed(wallet: string): boolean {
  const claims = loadClaims();
  return !!claims[wallet.toLowerCase()];
}

export async function handleFaucet(req: any, res: any): Promise<void> {
  const { wallet } = req.body;

  // 1. Validate wallet address
  if (!wallet || !isAddress(wallet)) {
    res.status(400).json({ error: 'Invalid wallet address' });
    return;
  }

  // 2. Check wallet hasn't already claimed
  if (hasClaimed(wallet)) {
    res.status(429).json({ error: 'This wallet has already claimed CELO' });
    return;
  }

  // 3. Check faucet balance
  try {
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance < MIN_BALANCE) {
      res.status(503).json({ error: 'Faucet temporarily empty' });
      return;
    }
  } catch {
    res.status(503).json({ error: 'Could not check faucet balance' });
    return;
  }

  // 4. Send CELO
  try {
    const txHash = await walletClient.sendTransaction({
      to:    wallet as `0x${string}`,
      value: FAUCET_AMOUNT
    });

    // 5. Save claim
    saveClaim(wallet);

    res.json({
      success: true,
      txHash,
      amount:  '0.1',
      message: 'CELO sent successfully'
    });
  } catch (err: any) {
    console.error('[faucet] Send failed:', err.message);
    res.status(500).json({ error: 'Failed to send CELO' });
  }
}
