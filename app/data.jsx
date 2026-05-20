const SUBJECTS = [
  {
    id: 'celo', name: 'CELO', ticker: 'CELO', category: 'ASSET',
    signal: 'NEUTRAL', score: 48, confidence: 35,
    summary: 'Sparse posts and mild price dip suggest neutral outlook.',
    updated: '14m ago', delta: -3, posts: 42,
  },
  {
    id: 'cusd', name: 'cUSD', ticker: 'cUSD', category: 'ASSET',
    signal: 'NEUTRAL', score: 50, confidence: 20,
    summary: 'Minimal activity, no significant crypto discussion.',
    updated: '14m ago', delta: 0, posts: 18,
  },
  {
    id: 'ckes', name: 'cKES', ticker: 'cKES', category: 'ASSET',
    signal: 'NEUTRAL', score: 50, confidence: 15,
    summary: 'Very low activity with no relevant recent discussions.',
    updated: '14m ago', delta: 0, posts: 9,
  },
  {
    id: 'btc', name: 'BTC', ticker: 'BTC', category: 'ASSET',
    signal: 'NEUTRAL', score: 42, confidence: 55,
    summary: 'Mixed signals with slight downside from news and price.',
    updated: '14m ago', delta: -2, posts: 1284,
  },
  {
    id: 'eth', name: 'ETH', ticker: 'ETH', category: 'ASSET',
    signal: 'BEARISH', score: 32, confidence: 55,
    summary: 'Foundation exits and institutional selling pressure.',
    updated: '8m ago', delta: -13, posts: 947,
  },
  {
    id: 'vitalik', name: 'Vitalik Buterin', ticker: '@VitalikButerin', category: 'PERSON',
    signal: 'BULLISH', score: 75, confidence: 65,
    summary: 'Posts on Ethereum scaling and AI formal verification.',
    updated: '6m ago', delta: 8, posts: 312,
  },
  {
    id: 'stable', name: 'Stablecoin Regulation', ticker: 'NARRATIVE', category: 'NARRATIVE',
    signal: 'NEUTRAL', score: 45, confidence: 20,
    summary: 'Minimal recent activity, neutral momentum.',
    updated: '38m ago', delta: 1, posts: 67,
  },
  {
    id: 'africa', name: 'Africa Crypto Adoption', ticker: 'NARRATIVE', category: 'NARRATIVE',
    signal: 'BULLISH', score: 72, confidence: 55,
    summary: 'Stablecoin partnerships and rising remittances boost momentum.',
    updated: '12m ago', delta: 20, posts: 421,
  },
];

const ACTIVITY = [
  { id: 1, kind: 'heartbeat', time: '2m ago',  text: 'Heartbeat #52 · 8 subjects scanned' },
  { id: 2, kind: 'bearish',   time: '8m ago',  text: 'ETH score updated: 45 → 32', sub: 'bearish signal' },
  { id: 3, kind: 'bullish',   time: '12m ago', text: 'Africa score updated: 52 → 72', sub: 'bullish signal' },
  { id: 4, kind: 'bullish',   time: '6m ago',  text: 'Vitalik score updated: 67 → 75', sub: 'bullish signal' },
  { id: 5, kind: 'heartbeat', time: '32m ago', text: 'Heartbeat #51 · 8 subjects scanned' },
  { id: 6, kind: 'event',     time: '38m ago', text: 'Stablecoin Regulation: first post indexed' },
  { id: 7, kind: 'heartbeat', time: '1h ago',  text: 'Heartbeat #50 · 8 subjects scanned' },
  { id: 8, kind: 'event',     time: '1h ago',  text: 'New predictor joined: 0x9f12…3aa1' },
  { id: 9, kind: 'heartbeat', time: '1h 32m',  text: 'Heartbeat #49 · 8 subjects scanned' },
];

const LEADERBOARD = [
  { rank: 1, addr: '0x7a3f…b1c4', streak: 27, accuracy: 84.2, you: false },
  { rank: 2, addr: '0x2e91…ff08', streak: 19, accuracy: 79.5, you: false },
  { rank: 3, addr: '0xc4d0…7e22', streak: 14, accuracy: 76.1, you: false },
  { rank: 4, addr: '0x1188…aab9', streak: 11, accuracy: 71.8, you: false },
  { rank: 5, addr: '0x5f6a…0c1d', streak:  9, accuracy: 68.4, you: false },
  { rank: 27,addr: '0xYOUR…aeco', streak:  3, accuracy: 54.0, you: true  },
];

Object.assign(window, { SUBJECTS, ACTIVITY, LEADERBOARD });
