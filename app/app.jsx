const { useState, useEffect, useMemo, useRef } = React;

/* ===================== Tweak defaults ===================== */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#f5c842",
  "density": "comfy",
  "showMarketStrip": true,
  "showAmbientGlow": true,
  "showDottedBg": true,
  "openModalOnLaunch": true,
  "animationSpeed": 1
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  '#f5c842', // gold (default)
  '#22c55e', // bull green
  '#a78bfa', // violet
  '#38bdf8', // cyan
];

/* ===================== Top nav with tabs ===================== */
function TopNav({ balance, lastScan, accent, activeTab, onChangeTab, loading, onConnect, isMiniPay, walletAddress }) {
  const tabs = [
    { id: 'feed',    label: 'Feed' },
    { id: 'predict', label: 'Predict' },
    { id: 'agent',   label: 'Agent' },
    { id: 'wallet',  label: 'Wallet' },
  ];

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-ink/85 border-b border-border">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center shrink-0">
          <svg viewBox="0 0 680 340" width="100" height="50">
            <ellipse cx="340" cy="150" rx="110" ry="68" fill="none" stroke="#f5c842" strokeWidth="1.5"/>
            <ellipse cx="340" cy="150" rx="109" ry="67" fill="none" stroke="#f5c842" strokeWidth="0.4" opacity="0.3"/>
            <line x1="230" y1="150" x2="254" y2="150" stroke="#f5c842" strokeWidth="1" opacity="0.5"/>
            <line x1="426" y1="150" x2="450" y2="150" stroke="#f5c842" strokeWidth="1" opacity="0.5"/>
            <circle cx="340" cy="150" r="42" fill="#0d1117" stroke="#22c9c9" strokeWidth="1.2"/>
            <circle cx="340" cy="150" r="36" fill="none" stroke="#f5c842" strokeWidth="0.5" opacity="0.4" strokeDasharray="4 3"/>
            <path d="M 303 138 A 42 42 0 0 1 377 138" fill="none" stroke="#22c9c9" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="340" cy="150" r="22" fill="#0d1117" stroke="#22c9c9" strokeWidth="1"/>
            <circle cx="340" cy="150" r="10" fill="#f5c842" opacity="0.6"/>
            <circle cx="340" cy="150" r="5" fill="#f5c842"/>
            <circle cx="334" cy="144" r="2.5" fill="#ffffff" opacity="0.7"/>
            <text x="340" y="262" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="38" fontWeight="600" letterSpacing="14" fill="#f5c842">AECO</text>
            <text x="340" y="290" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="11" letterSpacing="4" fill="#22c9c9" opacity="0.8">AI SENTIMENT ORACLE</text>
          </svg>
        </div>

        {/* Tabs */}
        <nav className="hidden md:flex items-center gap-0.5 h-10 p-1 rounded-lg bg-panel border border-border">
          {tabs.map(t => {
            const isActive = t.id === activeTab;
            return (
              <button
                key={t.id}
                onClick={() => onChangeTab(t.id)}
                className="relative px-4 h-8 rounded-md text-[12px] font-semibold tracking-wide transition-colors"
                style={{
                  color: isActive ? '#0a0a0f' : '#9ca3af',
                  background: isActive ? accent : 'transparent',
                  boxShadow: isActive ? `0 0 0 1px ${accent}40, 0 6px 16px -8px ${accent}80` : 'none',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#e5e7eb'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#9ca3af'; }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Live agent status */}
          <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-bull/[0.06] ring-1 ring-inset ring-bull/20">
            <span className="relative inline-flex">
              <span className="absolute inset-0 rounded-full breathe"></span>
              <span className="relative w-2 h-2 rounded-full bg-bull"></span>
            </span>
            <span className="text-[12px] text-bull font-semibold tracking-wide">{loading ? 'Syncing' : 'Live'}</span>
            <span className="w-px h-3 bg-bull/20"></span>
            <span className="text-[12px] text-gray-300 font-mono">{lastScan}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-md bg-panel border border-border">
            <div className="w-5 h-5 rounded-sm flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
              <span className="text-[9px] font-black text-ink">AEC</span>
            </div>
            <span className="tnum text-[13px] font-semibold text-white">{balance.toLocaleString()}</span>
            <span className="text-[11px] text-muted">AEC</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isMiniPay && (
              <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wide bg-bull/10 ring-1 ring-inset ring-bull/30 text-bull">
                MiniPay
              </span>
            )}
            {!isMiniPay && (
              <button
                className="px-3.5 py-1.5 rounded-md text-ink text-[12.5px] font-bold tracking-wide transition-opacity active:opacity-80 hover:opacity-90 font-mono"
                onClick={() => walletAddress ? onChangeTab('wallet') : onConnect()}
                style={{
                  background: accent,
                  boxShadow: `0 0 0 1px ${accent}40, 0 8px 30px -8px ${accent}66`,
                }}
              >
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ===================== Market strip ===================== */
function MarketStrip({ accent, subjects }) {
  const counts = useMemo(() => {
    const c = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
    subjects.forEach(s => c[s.signal]++);
    const avg = subjects.length > 0
      ? Math.round(subjects.reduce((a, s) => a + s.score, 0) / subjects.length)
      : 0;
    return { ...c, avg };
  }, [subjects]);

  const items = [
    { label: 'Avg Score', value: counts.avg, sub: 'across 8 subjects', color: accent },
    { label: 'Bullish', value: counts.BULLISH, sub: 'signals', color: '#22c55e' },
    { label: 'Bearish', value: counts.BEARISH, sub: 'signals', color: '#ef4444' },
    { label: 'Neutral', value: counts.NEUTRAL, sub: 'signals', color: '#9ca3af' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {items.map((it, i) => (
        <FadeIn
          key={it.label}
          delay={i * 50}
          y={8}
          duration={420}
          className="rounded-lg border border-border bg-panel/70 px-4 py-3 flex items-center gap-3"
        >
          <span className="block w-1 h-9 rounded-full" style={{ background: it.color, boxShadow: `0 0 12px ${it.color}66` }}></span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">{it.label}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-[22px] font-bold text-white"><CountUp to={it.value} duration={1200} delay={100 + i*80} /></span>
              <span className="text-[11px] text-muted">{it.sub}</span>
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}

/* ===================== Feed screen ===================== */
function FeedScreen({ filter, setFilter, onPredict, tweaks, subjects }) {
  const filtered = useMemo(() => {
    if (filter === 'ALL') return subjects;
    return subjects.filter(s => s.signal === filter);
  }, [filter, subjects]);

  const gridGap = tweaks.density === 'compact' ? 'gap-3' : tweaks.density === 'spacious' ? 'gap-7' : 'gap-5';

  return (
    <section>
      <SectionHeader
        title="Live Sentiment Feed"
        subtitle="8 subjects · refreshing every 5m"
        right={
          <div className="flex items-center gap-1 p-1 rounded-lg bg-panel border border-border">
            {['ALL', 'BULLISH', 'NEUTRAL', 'BEARISH'].map(f => {
              const isActive = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-2.5 py-1 rounded-md text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors"
                  style={{
                    color: isActive ? '#0a0a0f' : '#9ca3af',
                    background: isActive ? tweaks.accent : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#e5e7eb'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#9ca3af'; }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        }
      />

      {tweaks.showMarketStrip && <MarketStrip accent={tweaks.accent} subjects={subjects} />}

      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 ${gridGap}`}>
        {filtered.map((s, i) => (
          <SentimentCard key={s.id} subject={s} index={i} onPredict={onPredict} />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between text-[11px] text-muted">
        <div className="font-mono">Indexed from 14,028 posts in the last 24h · Powered by Aeco Agent v0.4.1</div>
        <button className="hover:opacity-100 opacity-80 link-underline" style={{ color: tweaks.accent }}>Methodology →</button>
      </div>
    </section>
  );
}

/* ===================== Agent screen ===================== */
function AgentScreen({ accent, activity, totalHeartbeats }) {
  return (
    <section>
      <SectionHeader title="Agent Activity" subtitle="indexer telemetry · streaming live" />

      {/* Hero stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Heartbeats', value: totalHeartbeats, sub: 'today', color: accent },
          { label: 'Posts',      value: 14028, sub: '24h indexed', color: '#22c55e' },
          { label: 'Subjects',   value: 8,     sub: 'tracked',     color: '#a78bfa' },
          { label: 'Uptime',     value: 99.7,  sub: '% this week', color: '#38bdf8', decimal: true },
        ].map((it, i) => (
          <FadeIn key={it.label} delay={i * 60} y={10} duration={460}
            className="rounded-xl border border-border bg-panel shadow-card p-5 relative overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${it.color}55, transparent)` }} />
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-semibold mb-2">{it.label}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-[32px] font-bold text-white leading-none">
                {it.decimal
                  ? <>{Math.floor(it.value)}.<CountUp to={Math.round((it.value % 1) * 10)} duration={900} delay={200 + i*60} /></>
                  : <CountUp to={it.value} duration={1300} delay={200 + i*60} />}
              </span>
              <span className="text-[12px] text-muted">{it.sub}</span>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Two-column: event log + methodology */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="rounded-xl border border-border bg-panel shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative inline-flex">
                <span className="absolute inset-0 rounded-full breathe"></span>
                <span className="relative w-2 h-2 rounded-full bg-bull"></span>
              </span>
              <h3 className="text-[14px] font-semibold text-white tracking-tight">Event Log</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-mono">LIVE · Block #28,401,902</span>
              <button className="text-[10.5px] font-semibold hover:opacity-100 opacity-80 link-underline" style={{ color: accent }}>
                Export CSV →
              </button>
            </div>
          </div>
          <div className="px-3 py-2">
            {activity.map((item, i) => (
              <ActivityRow key={item.id} item={item} index={i} />
            ))}
          </div>
          <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between text-[10.5px]">
            <span className="text-muted font-mono">Next heartbeat in <span className="text-gray-200">1m 14s</span></span>
            <button className="font-semibold" style={{ color: accent }}>Load older events →</button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl p-5"
            style={{
              border: `1px solid ${accent}33`,
              background: `linear-gradient(180deg, ${accent}11 0%, transparent 100%)`,
            }}>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-2" style={{ color: accent }}>Methodology</div>
            <h4 className="text-[15px] font-semibold text-white tracking-tight mb-2">How scoring works</h4>
            <p className="text-[12.5px] text-gray-300 leading-relaxed mb-3">
              The Aeco agent indexes posts across Farcaster, X, and Lens every 5 minutes. Each subject is scored 0–100 by an LLM ensemble weighted by post recency, author reputation, and engagement.
            </p>
            <div className="space-y-1.5 text-[11.5px] text-gray-400">
              <div className="flex items-center justify-between"><span>Scan interval</span><span className="font-mono text-gray-200">5m</span></div>
              <div className="flex items-center justify-between"><span>LLM ensemble</span><span className="font-mono text-gray-200">3 models</span></div>
              <div className="flex items-center justify-between"><span>Confidence floor</span><span className="font-mono text-gray-200">15%</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold mb-2">Sources</div>
            <div className="flex flex-wrap gap-1.5">
              {['Farcaster', 'X / Twitter', 'Lens', 'Mirror', 'CoinGecko', 'Dune'].map(s => (
                <span key={s} className="text-[10.5px] px-2 py-0.5 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] text-gray-300">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== Predict screen ===================== */
const STREAK_BONUS_THRESHOLD = 5;

function PredictScreen({ accent, onPredict, subjects, walletAddress }) {
  const [userStats, setUserStats] = useState({ totalPredictions: 0, correctPredictions: 0, currentStreak: 0, bestStreak: 0 });
  const [recentPredictions, setRecentPredictions] = useState([]);

  useEffect(() => {
    if (!walletAddress) return;
    window.AecoData.fetchUserStats(walletAddress).then((stats) => {
      if (stats) setUserStats(stats);
    });
  }, [walletAddress]);

  useEffect(() => {
    window.AecoData.fetchRecentPredictions(5).then((preds) => {
      if (preds && preds.length > 0) setRecentPredictions(preds);
    });
  }, []);

  const myStreak   = userStats.currentStreak;
  const myAccuracy = userStats.totalPredictions > 0
    ? Math.round((userStats.correctPredictions / userStats.totalPredictions) * 100)
    : 0;
  const myRank = walletAddress ? '--' : '--';

  const remaining = Math.max(0, STREAK_BONUS_THRESHOLD - myStreak);
  const streakBonusText = remaining > 0
    ? <>{remaining} more correct predictions for <span className="font-semibold" style={{ color: accent }}>2× rewards</span></>
    : <span className="font-semibold" style={{ color: accent }}>Streak bonus active — earning 2× rewards! 🎉</span>;

  const MOCK_WINS = [
    { addr: '0x7a3f…b1c4', subject: 'ETH',           side: 'LOWER',  earn: 20, signal: '#ef4444' },
    { addr: '0x2e91…ff08', subject: 'Africa Crypto', side: 'HIGHER', earn: 10, signal: '#22c55e' },
    { addr: '0xc4d0…7e22', subject: 'Vitalik',       side: 'HIGHER', earn: 20, signal: '#22c55e' },
    { addr: '0x1188…aab9', subject: 'BTC',           side: 'LOWER',  earn: 10, signal: '#ef4444' },
    { addr: '0x5f6a…0c1d', subject: 'CELO',          side: 'HIGHER', earn: 10, signal: '#22c55e' },
  ];

  const winsRows = recentPredictions.length > 0
    ? recentPredictions.map((p) => {
        const subjectName = subjects.find((s) => s.id === p.subjectId)?.name ?? `#${p.subjectId}`;
        const side        = p.predictedDirection === 1 ? 'HIGHER' : 'LOWER';
        const signal      = p.predictedDirection === 1 ? '#22c55e' : '#ef4444';
        let earn = null;
        if (!p.resolved) earn = 'Pending';
        else if (p.correct) earn = '+10';
        else earn = '—';
        return { addr: p.user, subject: subjectName, side, signal, earn, resolved: p.resolved, correct: p.correct };
      })
    : MOCK_WINS.map((w) => ({ ...w, earn: `+${w.earn}`, resolved: true, correct: true }));

  return (
    <section>
      <SectionHeader title="Predict" subtitle="earn AEC · build your streak" />

      {/* Streak hero row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5 mb-6">
        <FadeIn delay={60} y={12} duration={500}
          className="relative rounded-xl p-6 overflow-hidden"
          style={{
            border: `1px solid ${accent}33`,
            background: `radial-gradient(circle at 0% 0%, ${accent}1a 0%, transparent 60%), #13131c`,
          }}
        >
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-2" style={{ color: accent }}>Your Streak</div>
              <div className="flex items-baseline gap-3">
                <span className="tnum text-[64px] font-bold text-white leading-none">
                  <CountUp to={myStreak} duration={900} delay={120} />
                </span>
                <span className="text-orange-300 text-[40px]">🔥</span>
              </div>
              <div className="text-[13px] text-gray-400 mt-2">{streakBonusText}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">Rank</div>
              <div className="tnum text-[28px] font-bold text-white mt-1">#{myRank}</div>
              <div className="text-[11px] text-muted mt-0.5 tnum">{myAccuracy}% accuracy</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-5">
            {[1,2,3,4,5].map(n => {
              const lit = n <= Math.min(myStreak, 5);
              return (
                <div key={n} className="flex-1 h-2 rounded-full transition-all" style={{
                  background: lit ? accent : 'rgba(255,255,255,0.08)',
                  boxShadow: lit ? `0 0 10px ${accent}66` : 'none',
                }}></div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => subjects[0] && onPredict(subjects[0])}
              className="px-4 py-2.5 rounded-md text-[13px] font-semibold text-ink transition-opacity hover:opacity-90"
              style={{ background: accent }}
            >
              Pick a subject →
            </button>
            <span className="text-[11.5px] text-muted">Correct predictions earn <span className="font-semibold" style={{ color: accent }}>10 AEC</span></span>
          </div>
        </FadeIn>

        <FadeIn delay={120} y={12} duration={500}
          className="rounded-xl border border-border bg-panel p-5"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-semibold mb-3">Suggested for you</div>
          <div className="space-y-2.5">
            {subjects.slice(0, 3).map((s, i) => {
              if (!s) return null;
              const signal     = s.signal     ?? 'NEUTRAL';
              const score      = s.score      ?? 0;
              const confidence = s.confidence ?? 0;
              const color      = signalColor(signal);
              return (
                <button
                  key={s.id}
                  onClick={() => onPredict(s)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] hover:bg-white/[0.04] hover:ring-white/[0.08] transition text-left"
                >
                  <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
                    <ArcGauge value={score} color={color} size={36} stroke={3} delay={200 + i*80} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="tnum text-[11px] font-bold text-white mt-0.5">{score}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-white truncate">{s.name ?? 'Unknown'}</div>
                    <div className="text-[10.5px] text-muted">{score === 0 && confidence === 0 ? 'No data yet' : `${confidence}% confidence · ${s.posts?.toLocaleString() ?? '0'} posts`}</div>
                  </div>
                  <SignalBadge signal={signal} />
                </button>
              );
            })}
          </div>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Leaderboard */}
        <div className="rounded-xl border border-border bg-panel shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-white tracking-tight">Top Predictors</h3>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-mono">Week 14 · Pool 12,840 AEC</span>
          </div>
          <div className="px-2 py-2">
            <div className="flex items-center gap-3 px-3 pb-1.5 text-[9px] uppercase tracking-[0.16em] text-muted font-semibold">
              <div className="w-6 text-center">#</div>
              <div className="flex-1">Address</div>
              <div className="w-12 text-right">Streak</div>
              <div className="w-12 text-right">Acc.</div>
            </div>
            {(() => {
              const rows = window.LEADERBOARD.filter((r) => !r.you);
              if (walletAddress) {
                rows.push({
                  rank: '--',
                  addr: `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`,
                  streak: userStats.currentStreak,
                  accuracy: userStats.totalPredictions > 0
                    ? Math.round((userStats.correctPredictions / userStats.totalPredictions) * 100)
                    : 0,
                  you: true,
                });
              }
              return rows.map((row, i) => <LeaderRow key={row.rank} row={row} index={i} />);
            })()}
          </div>
          <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between text-[10.5px]">
            <span className="text-muted">Rewards distributed in <span className="text-gray-200 font-mono">3d 14h</span></span>
            <button className="font-semibold" style={{ color: accent }}>Full leaderboard →</button>
          </div>
        </div>

        {/* Recent wins */}
        <div className="rounded-xl border border-border bg-panel shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-white tracking-tight">Recent Wins</h3>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-mono">last 24h</span>
          </div>
          <div className="p-3 space-y-2">
            {winsRows.map((w, i) => (
              <FadeIn key={i} delay={200 + i * 60} y={6} duration={400}
                className="rounded-lg px-3 py-2.5 flex items-center gap-3 bg-white/[0.02] ring-1 ring-inset ring-white/[0.04]"
              >
                <div className="w-1.5 h-9 rounded-full" style={{ background: w.signal, boxShadow: `0 0 10px ${w.signal}66` }}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[12px] text-gray-200 truncate">{w.addr}</div>
                  <div className="text-[10.5px] text-muted">
                    <span className="font-semibold" style={{ color: w.signal }}>{w.side}</span> on {w.subject}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {w.earn === 'Pending' ? (
                    <div className="tnum text-[13px] font-semibold text-muted">Pending</div>
                  ) : w.earn === '—' ? (
                    <div className="tnum text-[15px] font-bold text-muted">—</div>
                  ) : (
                    <>
                      <div className="tnum text-[15px] font-bold" style={{ color: accent }}>{w.earn}</div>
                      <div className="text-[9px] uppercase tracking-[0.16em] text-muted font-semibold">AEC</div>
                    </>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== Wallet screen ===================== */
function WalletScreen({ accent, balance, isMiniPay, walletAddress, onConnect, onDisconnect }) {
  console.log('[WalletScreen] walletAddress:', walletAddress);
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <section>
      <SectionHeader
        title="Wallet"
        subtitle={walletAddress ? `Connected · ${shortAddress}` : 'connect to claim rewards'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <FadeIn delay={60} y={12} duration={520}
          className="relative rounded-2xl p-8 overflow-hidden"
          style={{
            border: `1px solid ${accent}33`,
            background: `radial-gradient(circle at 100% 0%, ${accent}1a 0%, transparent 50%), #13131c`,
          }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-2" style={{ color: accent }}>AEC Balance</div>
              <div className="flex items-baseline gap-3">
                <span className="tnum text-[64px] font-bold text-white leading-none">
                  <CountUp to={balance} duration={1300} delay={120} />
                </span>
                <span className="text-[16px] text-muted font-semibold">AEC</span>
              </div>
              <div className="text-[13px] text-gray-400 mt-2">≈ <span className="text-gray-200 tnum">$128.40</span> USD · earned this week <span className="font-semibold" style={{ color: accent }}>+84</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
                {walletAddress ? 'Address' : 'Network'}
              </div>
              <div className="flex items-center gap-1.5 mt-1 justify-end">
                <span className="w-2 h-2 rounded-full bg-bull"></span>
                {walletAddress
                  ? <span className="font-mono text-[12px] text-gray-200">{shortAddress}</span>
                  : <span className="text-[12.5px] font-semibold text-gray-200">Celo Mainnet</span>
                }
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'This week', value: '+84', sub: 'AEC',   color: accent },
              { label: 'All time',  value: '412', sub: 'AEC',   color: '#9ca3af' },
              { label: 'Streak ×2', value: '40',  sub: 'bonus', color: '#22c55e' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-ink/60 ring-1 ring-inset ring-white/[0.04] px-3 py-2.5">
                <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted font-semibold">{s.label}</div>
                <div className="tnum text-[20px] font-bold leading-none mt-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-muted mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            {!isMiniPay && (
              walletAddress
                ? <button
                    onClick={onDisconnect}
                    className="px-5 py-2.5 rounded-md text-[13px] font-semibold text-gray-200 bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] hover:bg-bear/10 hover:ring-bear/30 hover:text-bear transition"
                  >
                    Disconnect
                  </button>
                : <button
                    onClick={onConnect}
                    className="px-5 py-2.5 rounded-md text-[13px] font-semibold text-ink hover:opacity-90 transition-opacity"
                    style={{ background: accent, boxShadow: `0 0 0 1px ${accent}40, 0 8px 30px -8px ${accent}66` }}
                  >
                    Connect Celo Wallet
                  </button>
            )}
            <button className="px-5 py-2.5 rounded-md text-[13px] font-semibold text-gray-200 bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.07] transition">
              How to earn
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={140} y={12} duration={500}
          className="rounded-xl border border-border bg-panel p-5"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-semibold mb-3">Recent Activity</div>
          <div className="space-y-2.5">
            {[
              { type: 'Reward', detail: 'ETH prediction', value: '+20', positive: true },
              { type: 'Reward', detail: 'Africa prediction', value: '+10', positive: true },
              { type: 'Stake',  detail: 'Subject add: cKES',  value: '-5',  positive: false },
              { type: 'Reward', detail: 'Vitalik prediction', value: '+20', positive: true },
              { type: 'Reward', detail: 'BTC prediction',     value: '+10', positive: true },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.04]">
                <div>
                  <div className="text-[11.5px] font-semibold text-gray-200">{r.type}</div>
                  <div className="text-[10.5px] text-muted">{r.detail}</div>
                </div>
                <div className="tnum text-[14px] font-bold" style={{ color: r.positive ? accent : '#9ca3af' }}>{r.value}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ===================== Root ===================== */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [activeTab, setActiveTab] = useState('feed');
  const [modalSubject, setModalSubject] = useState(() => t.openModalOnLaunch ? window.SUBJECTS[0] : null);
  const [filter, setFilter] = useState('ALL');

  // Live data state — initialised from mock data so UI renders immediately
  const [subjects, setSubjects]       = useState(window.SUBJECTS);
  const [activity, setActivity]       = useState(window.ACTIVITY);
  const [agentStatus, setAgentStatus] = useState(null);
  const [balance, setBalance]         = useState(1284);
  const [loading, setLoading]         = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [isMiniPay, setIsMiniPay] = useState(Boolean(window.ethereum?.isMiniPay));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const api = window.AecoData;
        if (!api) return;
        const [liveSubjects, liveStatus, liveActivity] = await Promise.all([
          api.fetchAllSubjects(),
          api.fetchAgentStatus(),
          api.fetchHeartbeats(10),
        ]);
        if (cancelled) return;
        if (liveSubjects?.length > 0) setSubjects(liveSubjects);
        if (liveStatus)               setAgentStatus(liveStatus);
        if (liveActivity?.length > 0) setActivity(liveActivity);
      } catch {
        // silently keep mock data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Auto-connect when running inside MiniPay (provider is available immediately on page load).
  // MiniPay only supports legacy transactions — use type: 'legacy' and omit
  // maxFeePerGas/maxPriorityFeePerGas when building any transaction for predictions.
  useEffect(() => {
    async function connectMiniPay() {
      if (window.ethereum && window.ethereum.isMiniPay) {
        setIsMiniPay(true);
        try {
          const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
            params: [],
          });
          if (accounts && accounts[0]) {
            setWalletAddress(accounts[0]);
            const bal = await window.AecoData?.fetchTokenBalance?.(accounts[0]);
            if (bal) {
              const num = parseInt(bal.replace(/,/g, ''), 10);
              if (!isNaN(num)) setBalance(num);
            }
          }
        } catch (err) {
          console.error('MiniPay connect error:', err);
        }
      }
    }
    connectMiniPay();
  }, []);

  const handleConnect = async () => {
    if (!window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts?.[0];
      if (!address) return;
      setWalletAddress(address);
      setIsMiniPay(Boolean(window.ethereum?.isMiniPay));
      const bal = await window.AecoData?.fetchTokenBalance?.(address);
      if (bal) {
        const num = parseInt(bal.replace(/,/g, ''), 10);
        if (!isNaN(num)) setBalance(num);
      }
    } catch (err) {
      console.error('[wallet] connect failed:', err);
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setBalance(0);
    setIsMiniPay(false);
  };

  const handlePredict = (subject) => setModalSubject(subject);
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setModalSubject(null);
  };

  const lastScan = agentStatus?.lastScan ?? '4 mins ago';
  const totalHeartbeats = agentStatus?.totalHeartbeats ?? 52;

  return (
    <div className={`min-h-screen bg-ink relative ${t.showDottedBg ? 'bg-grid' : ''}`}>
      {/* Ambient glow */}
      {t.showAmbientGlow && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full drift"
            style={{ background: `radial-gradient(circle, ${t.accent}10 0%, transparent 70%)` }}></div>
          <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full drift"
            style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)', animationDelay: '4s' }}></div>
        </div>
      )}

      <TopNav
        balance={balance}
        lastScan={lastScan}
        accent={t.accent}
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        loading={loading}
        onConnect={handleConnect}
        isMiniPay={isMiniPay}
        walletAddress={walletAddress}
      />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 pb-24 md:pb-8 relative">
        {activeTab === 'feed'    && <FeedScreen filter={filter} setFilter={setFilter} onPredict={handlePredict} tweaks={t} subjects={subjects} />}
        {activeTab === 'agent'   && <AgentScreen accent={t.accent} activity={activity} totalHeartbeats={totalHeartbeats} />}
        {activeTab === 'predict' && <PredictScreen accent={t.accent} onPredict={handlePredict} subjects={subjects} walletAddress={walletAddress} />}
        {activeTab === 'wallet'  && <WalletScreen accent={t.accent} balance={balance} isMiniPay={isMiniPay} walletAddress={walletAddress} onConnect={handleConnect} onDisconnect={handleDisconnect} />}
      </main>

      <PredictionModal subject={modalSubject} onClose={() => setModalSubject(null)} />

      <TweaksPanel title="Aeco Tweaks">
        <TweakSection label="Theme">
          <TweakColor
            label="Accent"
            value={t.accent}
            options={ACCENT_OPTIONS}
            onChange={(v) => setTweak('accent', v)}
          />
          <TweakRadio
            label="Density"
            value={t.density}
            options={[
              { value: 'compact',  label: 'Compact' },
              { value: 'comfy',    label: 'Comfy'   },
              { value: 'spacious', label: 'Roomy'   },
            ]}
            onChange={(v) => setTweak('density', v)}
          />
          <TweakSlider
            label="Animation speed"
            value={t.animationSpeed}
            min={0.2} max={2} step={0.1} unit="×"
            onChange={(v) => setTweak('animationSpeed', v)}
          />
        </TweakSection>

        <TweakSection label="Layout">
          <TweakToggle
            label="Market strip"
            value={t.showMarketStrip}
            onChange={(v) => setTweak('showMarketStrip', v)}
          />
          <TweakToggle
            label="Ambient glow"
            value={t.showAmbientGlow}
            onChange={(v) => setTweak('showAmbientGlow', v)}
          />
          <TweakToggle
            label="Dotted background"
            value={t.showDottedBg}
            onChange={(v) => setTweak('showDottedBg', v)}
          />
        </TweakSection>

        <TweakSection label="Behaviour">
          <TweakToggle
            label="Open prediction modal on launch"
            value={t.openModalOnLaunch}
            onChange={(v) => setTweak('openModalOnLaunch', v)}
          />
        </TweakSection>
      </TweaksPanel>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-ink/95 backdrop-blur-md border-t border-border">
        <div className="flex items-stretch h-16">
          {[
            { id: 'feed',    label: 'Feed',    icon: (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="11" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            )},
            { id: 'predict', label: 'Predict', icon: (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )},
            { id: 'agent',   label: 'Agent',   icon: (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 13l4-4 3 3 4-5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="10" cy="3.5" r="1.5" fill="currentColor"/>
              </svg>
            )},
            { id: 'wallet',  label: 'Wallet',  icon: (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="14.5" cy="13" r="1" fill="currentColor"/>
              </svg>
            )},
          ].map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
                style={{ color: isActive ? t.accent : '#6b7280' }}
              >
                {tab.icon}
                <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: t.accent }} />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
