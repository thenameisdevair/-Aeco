/* data.jsx — live chain data for the Aeco mobile app
 * Sets window.SUBJECTS with static fallback immediately, then replaces
 * with live chain data and dispatches 'aeco:dataReady' when complete.
 */
const SENTIMENT_FEED  = '0x0684191E2e8Ac149F0073875242af19eC08D0724';
const HYBRID_SUBJECTS = new Set([4, 5, 9]);
const SIGNAL_MAP = { 0: 'NEUTRAL', 1: 'BULLISH', 2: 'BEARISH' };
const CAT_MAP    = { 1: 'ASSET',   2: 'PERSON',  3: 'NARRATIVE' };

const SENTIMENT_ABI = [
  {
    name: 'getAllSubjects', type: 'function', stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'all', type: 'tuple[]', components: [
      { name: 'id',       type: 'uint256' },
      { name: 'name',     type: 'string'  },
      { name: 'category', type: 'uint8'   },
      { name: 'isActive', type: 'bool'    },
    ]}],
  },
  {
    name: 'getLatest', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'subjectId', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple', components: [
      { name: 'subjectId',      type: 'uint256' },
      { name: 'score',          type: 'uint8'   },
      { name: 'signal',         type: 'uint8'   },
      { name: 'confidence',     type: 'uint8'   },
      { name: 'summary',        type: 'string'  },
      { name: 'sourceType',     type: 'string'  },
      { name: 'timestamp',      type: 'uint256' },
      { name: 'deltaFromLast',  type: 'int8'    },
      { name: 'agentVersion',   type: 'string'  },
      { name: 'socialScore',    type: 'uint8'   },
      { name: 'nansenFlow',     type: 'int256'  },
      { name: 'divergenceFlag', type: 'bool'    },
    ]}],
  },
];

function timeAgo(unixSeconds) {
  const diff = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Static fallback — shown immediately while chain loads
window.SUBJECTS = [
  { id:'celo',   name:'CELO',                  ticker:'CELO',  category:'ASSET',     signal:'NEUTRAL', score:50, confidence:30, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:false, nansenFlow:0n, divergenceFlag:false },
  { id:'cusd',   name:'cUSD',                  ticker:'cUSD',  category:'ASSET',     signal:'NEUTRAL', score:50, confidence:20, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:false, nansenFlow:0n, divergenceFlag:false },
  { id:'ckes',   name:'cKES',                  ticker:'cKES',  category:'ASSET',     signal:'NEUTRAL', score:50, confidence:20, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:false, nansenFlow:0n, divergenceFlag:false },
  { id:'btc',    name:'BTC',                   ticker:'BTC',   category:'ASSET',     signal:'NEUTRAL', score:50, confidence:50, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:true,  nansenFlow:0n, divergenceFlag:false },
  { id:'eth',    name:'ETH',                   ticker:'ETH',   category:'ASSET',     signal:'NEUTRAL', score:50, confidence:50, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:true,  nansenFlow:0n, divergenceFlag:false },
  { id:'vitalik',name:'Vitalik Buterin',        ticker:'VB',    category:'PERSON',    signal:'NEUTRAL', score:50, confidence:50, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:false, nansenFlow:0n, divergenceFlag:false },
  { id:'stable', name:'Stablecoin Regulation',  ticker:'REG',   category:'NARRATIVE', signal:'NEUTRAL', score:50, confidence:30, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:false, nansenFlow:0n, divergenceFlag:false },
  { id:'africa', name:'Africa Crypto Adoption', ticker:'AFR',   category:'NARRATIVE', signal:'NEUTRAL', score:50, confidence:30, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:false, nansenFlow:0n, divergenceFlag:false },
  { id:'sol',    name:'SOL',                   ticker:'SOL',   category:'ASSET',     signal:'NEUTRAL', score:50, confidence:40, summary:'Loading live data...', updated:'—', delta:0, posts:0, isHybrid:true,  nansenFlow:0n, divergenceFlag:false },
];

// Load live data from chain
(async () => {
  try {
    const { createPublicClient, http, keccak256 } = await import('https://esm.sh/viem@2.50.4');
    const client = createPublicClient({
      chain: {
        id: 42220, name: 'Celo',
        nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
        rpcUrls: { default: { http: ['https://forno.celo.org'] } },
      },
      transport: http('https://forno.celo.org'),
    });

    // Read recordHistory[subjectId].length directly from storage
    // Uses keccak256(abi.encode(subjectId, 3)) where 3 = recordHistory mapping slot
    async function getHistoryLength(subjectId) {
      try {
        // abi.encode(uint256 subjectId, uint256 slot) = 64 bytes, zero-padded
        const keyHex  = BigInt(subjectId).toString(16).padStart(64, '0');
        const slotHex = (3).toString(16).padStart(64, '0');
        const lengthSlot = keccak256(`0x${keyHex}${slotHex}`);
        const raw = await client.getStorageAt({
          address: SENTIMENT_FEED,
          slot:    lengthSlot,
        });
        return raw ? parseInt(raw, 16) : 0;
      } catch { return 0; }
    }

    const allSubjects = await client.readContract({
      address: SENTIMENT_FEED, abi: SENTIMENT_ABI, functionName: 'getAllSubjects',
    });

    const results = await Promise.all(
      allSubjects.filter(s => s.isActive).map(async (s) => {
        try {
          const rec = await client.readContract({
            address: SENTIMENT_FEED, abi: SENTIMENT_ABI,
            functionName: 'getLatest', args: [s.id],
          });
          if (!rec || rec.timestamp === 0n) return null;
          const historyLength = await getHistoryLength(Number(s.id));
          const isHybrid = HYBRID_SUBJECTS.has(Number(s.id));
          return {
            id:            s.name.toLowerCase().replace(/[\s.]+/g, '-'),
            name:          s.name,
            ticker:        s.name,
            category:      CAT_MAP[Number(s.category)] ?? 'ASSET',
            signal:        SIGNAL_MAP[rec.signal] ?? 'NEUTRAL',
            score:         rec.score,
            confidence:    rec.confidence,
            summary:       rec.summary,
            updated:       timeAgo(rec.timestamp),
            delta:         rec.deltaFromLast,
            posts:         historyLength,
            isHybrid,
            nansenFlow:    rec.nansenFlow,
            divergenceFlag: rec.divergenceFlag,
            socialScore:   rec.socialScore,
          };
        } catch { return null; }
      })
    );

    const live = results.filter(Boolean);
    if (live.length > 0) {
      window.SUBJECTS = live;
      window.dispatchEvent(new CustomEvent('aeco:dataReady'));
    }
  } catch (err) {
    console.error('[data] Live fetch failed, keeping fallback:', err);
  }
})();
