import { createPublicClient, http, formatUnits, encodeFunctionData } from 'https://esm.sh/viem@2.50.4';

// ─── Chain ────────────────────────────────────────────────────────────────────

const celoMainnet = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://ferno.celo.org'] } },
};

// ─── Client ───────────────────────────────────────────────────────────────────

const client = createPublicClient({
  chain: celoMainnet,
  transport: http('https://celo-mainnet.g.alchemy.com/v2/vn-E1O50rnrL3DAj_9de2'),
});

// ─── Addresses ────────────────────────────────────────────────────────────────

const SENTIMENT_FEED   = '0x0684191E2e8Ac149F0073875242af19eC08D0724';
const HEARTBEAT_ORACLE = '0x2199C72E411ed90fB10772259E3194791406EAd9';
const AEC_TOKEN        = '0x4EbACf161bae6e52Ff52F12ab217c175f1D856D4';

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const SENTIMENT_ABI = [
  {
    name: 'getAllSubjects',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      name: 'all',
      type: 'tuple[]',
      components: [
        { name: 'id',       type: 'uint256' },
        { name: 'name',     type: 'string'  },
        { name: 'category', type: 'uint8'   },
        { name: 'isActive', type: 'bool'    },
      ],
    }],
  },
  {
    name: 'getLatest',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'subjectId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'subjectId',     type: 'uint256' },
        { name: 'score',         type: 'uint8'   },
        { name: 'signal',        type: 'uint8'   },
        { name: 'confidence',    type: 'uint8'   },
        { name: 'summary',       type: 'string'  },
        { name: 'sourceType',    type: 'string'  },
        { name: 'timestamp',     type: 'uint256' },
        { name: 'deltaFromLast', type: 'int8'    },
        { name: 'agentVersion',  type: 'string'  },
      ],
    }],
  },
];

const HEARTBEAT_ABI = [
  {
    name: 'lastHeartbeat',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    // Public struct getter — Solidity exposes each field as a separate named output
    outputs: [
      { name: 'timestamp',         type: 'uint256' },
      { name: 'subjectsScanned',   type: 'uint256' },
      { name: 'significantChange', type: 'bool'    },
      { name: 'statusMessage',     type: 'string'  },
    ],
  },
  {
    name: 'totalHeartbeats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getHistory',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [{
      name: 'records',
      type: 'tuple[]',
      components: [
        { name: 'timestamp',         type: 'uint256' },
        { name: 'subjectsScanned',   type: 'uint256' },
        { name: 'significantChange', type: 'bool'    },
        { name: 'statusMessage',     type: 'string'  },
      ],
    }],
  },
];

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ name: '',        type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABEL = { 1: 'ASSET', 2: 'PERSON', 3: 'NARRATIVE', 4: 'PREMIUM' };
const SIGNAL_LABEL   = { 0: 'NEUTRAL', 1: 'BULLISH', 2: 'BEARISH' };

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  return mins === 0 ? `${hours}h ago` : `${hours}h ${mins}m ago`;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Reads getAllSubjects() then getLatest() for each subject.
 * Returns an array matching the SUBJECTS shape used by the dashboard.
 */
export async function fetchAllSubjects() {
  try {
    const subjects = await client.readContract({
      address: SENTIMENT_FEED,
      abi: SENTIMENT_ABI,
      functionName: 'getAllSubjects',
    });

    const records = await Promise.all(
      subjects.map((s) =>
        client.readContract({
          address: SENTIMENT_FEED,
          abi: SENTIMENT_ABI,
          functionName: 'getLatest',
          args: [s.id],
        }).catch(() => null)
      )
    );

    return subjects.map((subject, i) => {
      const rec = records[i];
      return {
        id:         Number(subject.id),
        name:       subject.name,
        category:   CATEGORY_LABEL[subject.category] ?? 'ASSET',
        signal:     rec ? (SIGNAL_LABEL[rec.signal] ?? 'NEUTRAL') : 'NEUTRAL',
        score:      rec ? rec.score                              : 0,
        confidence: rec ? rec.confidence                         : 0,
        summary:    rec ? rec.summary                            : '',
        updated:    rec && rec.timestamp ? timeAgo(rec.timestamp) : 'never',
        delta:      rec ? Number(rec.deltaFromLast)               : 0,
      };
    });
  } catch (err) {
    console.error('[data-live] fetchAllSubjects failed:', err);
    return [];
  }
}

/**
 * Reads getHistory(count) from HeartbeatOracle.
 * Returns an array of activity items matching the ACTIVITY shape, most-recent first.
 */
export async function fetchHeartbeats(count) {
  try {
    const [records, total] = await Promise.all([
      client.readContract({
        address: HEARTBEAT_ORACLE,
        abi: HEARTBEAT_ABI,
        functionName: 'getHistory',
        args: [BigInt(count)],
      }),
      client.readContract({
        address: HEARTBEAT_ORACLE,
        abi: HEARTBEAT_ABI,
        functionName: 'totalHeartbeats',
      }),
    ]);

    const totalNum = Number(total);
    // getHistory returns oldest-first; reverse so most-recent is first (matches ACTIVITY order)
    return [...records].reverse().map((rec, i) => ({
      id:   totalNum - i,
      kind: 'heartbeat',
      time: timeAgo(rec.timestamp),
      text: `Heartbeat #${totalNum - i} · ${Number(rec.subjectsScanned)} subjects scanned`,
    }));
  } catch (err) {
    console.error('[data-live] fetchHeartbeats failed:', err);
    return [];
  }
}

/**
 * Reads lastHeartbeat and totalHeartbeats from HeartbeatOracle.
 * isAlive is true when the last heartbeat is less than 4 hours old (2× the agent cycle).
 */
export async function fetchAgentStatus() {
  try {
    const [hb, total] = await Promise.all([
      client.readContract({
        address: HEARTBEAT_ORACLE,
        abi: HEARTBEAT_ABI,
        functionName: 'lastHeartbeat',
      }),
      client.readContract({
        address: HEARTBEAT_ORACLE,
        abi: HEARTBEAT_ABI,
        functionName: 'totalHeartbeats',
      }),
    ]);

    // viem returns named multiple outputs as an object; guard for array fallback
    const timestamp  = Number(Array.isArray(hb) ? hb[0] : hb.timestamp);
    const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;

    return {
      isAlive:         timestamp > 0 && ageSeconds < 4 * 60 * 60,
      lastScan:        timestamp > 0 ? timeAgo(timestamp) : 'never',
      totalHeartbeats: Number(total),
    };
  } catch (err) {
    console.error('[data-live] fetchAgentStatus failed:', err);
    return null;
  }
}

/**
 * Reads ERC20 balance of `address` from AECToken.
 * Returns a formatted string like "1,240 AEC", or null on error.
 */
export async function fetchTokenBalance(address) {
  try {
    const [raw, decimals] = await Promise.all([
      client.readContract({
        address: AEC_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }),
      client.readContract({
        address: AEC_TOKEN,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    const whole = Math.floor(Number(formatUnits(raw, decimals)));
    return `${whole.toLocaleString()} AEC`;
  } catch (err) {
    console.error('[data-live] fetchTokenBalance failed:', err);
    return null;
  }
}

/**
 * Sends a makePrediction transaction via window.ethereum.
 * direction: 1 = higher, 2 = lower
 */
export async function makePrediction(subjectId, direction) {
  if (!window.ethereum) throw new Error('No wallet detected');

  const data = encodeFunctionData({
    abi: [{
      name: 'makePrediction',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'subjectId', type: 'uint256' },
        { name: 'direction', type: 'uint8' }
      ],
      outputs: []
    }],
    functionName: 'makePrediction',
    args: [BigInt(subjectId), direction]
  });

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

  const CELO_CHAIN_ID = '0xa4ec';
  const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChain !== CELO_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CELO_CHAIN_ID }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CELO_CHAIN_ID,
            chainName: 'Celo Mainnet',
            nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
            rpcUrls: ['https://ferno.celo.org'],
            blockExplorerUrls: ['https://celoscan.io'],
          }],
        });
      } else {
        throw switchErr;
      }
    }
  }

  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to: '0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC',
      data,
      type: '0x0'
    }]
  });

  return txHash;
}

// ─── PredictionGame ───────────────────────────────────────────────────────────

const PREDICTION_GAME = '0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC';

const PREDICTION_GAME_ABI = [
  {
    name: 'getUserStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'totalPredictions',   type: 'uint256' },
        { name: 'correctPredictions', type: 'uint256' },
        { name: 'currentStreak',      type: 'uint256' },
        { name: 'bestStreak',         type: 'uint256' },
      ],
    }],
  },
  {
    name: 'getUserPredictions',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user',  type: 'address' },
      { name: 'count', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'predictionCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getPrediction',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'user',                 type: 'address' },
        { name: 'subjectId',            type: 'uint256' },
        { name: 'predictedDirection',   type: 'uint8'   },
        { name: 'madeAtScore',          type: 'uint8'   },
        { name: 'madeAtTimestamp',      type: 'uint256' },
        { name: 'resolveAfterTimestamp', type: 'uint256' },
        { name: 'resolved',             type: 'bool'    },
        { name: 'correct',              type: 'bool'    },
      ],
    }],
  },
];

function truncateAddress(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Reads getUserStats(address) from PredictionGame.
 * Returns { totalPredictions, correctPredictions, currentStreak, bestStreak } as Numbers,
 * or null on error / missing address.
 */
export async function fetchUserStats(address) {
  if (!address) return null;
  try {
    const stats = await client.readContract({
      address: PREDICTION_GAME,
      abi: PREDICTION_GAME_ABI,
      functionName: 'getUserStats',
      args: [address],
    });
    return {
      totalPredictions:   Number(stats.totalPredictions),
      correctPredictions: Number(stats.correctPredictions),
      currentStreak:      Number(stats.currentStreak),
      bestStreak:         Number(stats.bestStreak),
    };
  } catch (err) {
    console.error('[data-live] fetchUserStats failed:', err);
    return null;
  }
}

/**
 * Reads getUserPredictions(address, count) from PredictionGame.
 * Returns an array of prediction IDs as Numbers, or [] on error.
 */
export async function fetchUserPredictions(address, count) {
  if (!address) return [];
  try {
    const ids = await client.readContract({
      address: PREDICTION_GAME,
      abi: PREDICTION_GAME_ABI,
      functionName: 'getUserPredictions',
      args: [address, BigInt(count)],
    });
    return ids.map(Number);
  } catch (err) {
    console.error('[data-live] fetchUserPredictions failed:', err);
    return [];
  }
}

/**
 * Reads the last `count` predictions from PredictionGame via predictionCount + getPrediction.
 * Returns array of { id, user, subjectId, predictedDirection, madeAtScore, resolved, correct },
 * or [] on error.
 */
export async function fetchRecentPredictions(count) {
  try {
    const total = await client.readContract({
      address: PREDICTION_GAME,
      abi: PREDICTION_GAME_ABI,
      functionName: 'predictionCount',
    });

    const totalNum = Number(total);
    if (totalNum === 0) return [];

    const start = Math.max(1, totalNum - count + 1);
    const ids = [];
    for (let i = start; i <= totalNum; i++) ids.push(i);

    const predictions = await Promise.all(
      ids.map((id) =>
        client.readContract({
          address: PREDICTION_GAME,
          abi: PREDICTION_GAME_ABI,
          functionName: 'getPrediction',
          args: [BigInt(id)],
        }).catch(() => null)
      )
    );

    return predictions
      .map((p, i) => {
        if (!p) return null;
        return {
          id:                 ids[i],
          user:               truncateAddress(p.user),
          subjectId:          Number(p.subjectId),
          predictedDirection: Number(p.predictedDirection),
          madeAtScore:        Number(p.madeAtScore),
          resolved:           p.resolved,
          correct:            p.correct,
        };
      })
      .filter(Boolean)
      .reverse();
  } catch (err) {
    console.error('[data-live] fetchRecentPredictions failed:', err);
    return [];
  }
}

/**
 * Sends a resolvePrediction transaction via window.ethereum.
 * Permissionless — anyone can call after resolveAfterTimestamp has passed.
 */
export async function resolvePrediction(predictionId) {
  if (!window.ethereum) throw new Error('No wallet detected');

  const data = encodeFunctionData({
    abi: [{
      name: 'resolvePrediction',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs:  [{ name: 'predictionId', type: 'uint256' }],
      outputs: [],
    }],
    functionName: 'resolvePrediction',
    args: [BigInt(predictionId)],
  });

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to:   '0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC',
      data,
      type: '0x0',
    }],
  });

  return txHash;
}

/**
 * Submits user feedback to the ERC-8004 Reputation Registry on behalf of the connected wallet.
 * Called after a successful prediction — the user rates the oracle they just bet on.
 */
export async function submitUserFeedback(userAddress, score, tag1 = 'prediction', tag2 = 'engaged') {
  if (!window.ethereum) return null;

  const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
  const AGENT_ID = 9112n;

  const data = encodeFunctionData({
    abi: [{
      name: 'giveFeedback',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'agentId',      type: 'uint256' },
        { name: 'score',        type: 'int128'  },
        { name: 'decimals',     type: 'uint8'   },
        { name: 'tag1',         type: 'string'  },
        { name: 'tag2',         type: 'string'  },
        { name: 'endpoint',     type: 'string'  },
        { name: 'feedbackURI',  type: 'string'  },
        { name: 'feedbackHash', type: 'bytes32' },
      ],
      outputs: []
    }],
    functionName: 'giveFeedback',
    args: [
      AGENT_ID,
      BigInt(Math.round(score)),
      0n,
      tag1,
      tag2,
      'https://aeco-eight.vercel.app',
      '',
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ]
  });

  return window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: userAddress,
      to: REPUTATION_REGISTRY,
      data,
      type: '0x0'
    }]
  });
}

/**
 * Checks for window.ethereum and whether it's MiniPay.
 * Reads accounts with eth_accounts (no popup).
 * Returns { provider, isMiniPay, address } — address is null when no account is connected.
 */
export async function detectWallet() {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return { provider: null, isMiniPay: false, address: null };
    }

    const provider  = window.ethereum;
    const isMiniPay = Boolean(provider.isMiniPay);

    let address = null;
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      address = accounts?.[0] ?? null;
    } catch {
      // provider present but account access unavailable
    }

    return { provider, isMiniPay, address };
  } catch (err) {
    console.error('[data-live] detectWallet failed:', err);
    return { provider: null, isMiniPay: false, address: null };
  }
}
