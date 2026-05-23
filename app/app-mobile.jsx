const { useState, useEffect, useMemo, useRef } = React;

/* ===================== Tweak defaults ===================== */
/* The block between EDITMODE markers must be valid JSON. */
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

/* ===================== Shared UI ===================== */
function MobileTopNav({ balance, lastScan, accent }) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-ink/85 border-b border-border">
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center min-w-0">
          <svg viewBox="0 0 680 340" width="84" height="42" className="shrink-0">
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

        <div className="flex items-center gap-1.5 shrink-0">
          <button className="w-9 h-9 rounded-md bg-panel border border-border flex items-center justify-center active:bg-panel2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M2 7h10M2 10h10" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className="px-3 h-9 rounded-md text-ink text-[11.5px] font-bold tracking-wide active:opacity-80 transition-opacity"
            style={{
              background: accent,
              boxShadow: `0 0 0 1px ${accent}40, 0 8px 24px -8px ${accent}66`,
            }}
          >
            Connect
          </button>
        </div>
      </div>

      <div className="px-4 pb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-bull/[0.07] ring-1 ring-inset ring-bull/20">
          <span className="relative inline-flex">
            <span className="absolute inset-0 rounded-full breathe"></span>
            <span className="relative w-1.5 h-1.5 rounded-full bg-bull"></span>
          </span>
          <span className="text-[10.5px] text-bull font-semibold tracking-wide">Agent Live</span>
          <span className="w-px h-2.5 bg-bull/20"></span>
          <span className="text-[10.5px] text-gray-300 font-mono">{lastScan}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-panel border border-border">
          <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
            <span className="text-[7px] font-black text-ink leading-none">A</span>
          </div>
          <span className="tnum text-[11.5px] font-semibold text-white">{balance.toLocaleString()}</span>
          <span className="text-[10px] text-muted">AEC</span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-3">
      <div className="flex items-end justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-white tracking-tight leading-tight">{title}</h2>
          {subtitle && <div className="text-[10.5px] text-muted font-mono mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="h-px w-24 gradient-underline rounded-full"></div>
    </div>
  );
}

/* ===================== Market strip ===================== */
function MobileMarketStrip({ accent }) {
  const counts = useMemo(() => {
    const c = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
    window.SUBJECTS.forEach(s => c[s.signal]++);
    const avg = Math.round(window.SUBJECTS.reduce((a, s) => a + s.score, 0) / window.SUBJECTS.length);
    return { ...c, avg };
  }, []);

  const items = [
    { label: 'Avg', value: counts.avg, sub: 'score', color: accent },
    { label: 'Bull', value: counts.BULLISH, sub: 'signals', color: '#22c55e' },
    { label: 'Bear', value: counts.BEARISH, sub: 'signals', color: '#ef4444' },
    { label: 'Neutral', value: counts.NEUTRAL, sub: 'signals', color: '#9ca3af' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {items.map((it, i) => (
        <FadeIn
          key={it.label}
          delay={i * 50}
          y={8}
          duration={420}
          className="rounded-lg border border-border bg-panel/70 px-2 py-2"
        >
          <div className="flex items-center gap-1 mb-0.5">
            <span className="block w-1 h-3 rounded-full" style={{ background: it.color, boxShadow: `0 0 8px ${it.color}66` }}></span>
            <div className="text-[8.5px] uppercase tracking-[0.16em] text-muted font-semibold">{it.label}</div>
          </div>
          <div className="tnum text-[18px] font-bold text-white leading-none mt-1">
            <CountUp to={it.value} duration={1100} delay={100 + i*80} />
          </div>
          <div className="text-[9px] text-muted mt-0.5">{it.sub}</div>
        </FadeIn>
      ))}
    </div>
  );
}

function FilterPills({ value, onChange, accent }) {
  const opts = ['ALL', 'BULLISH', 'NEUTRAL', 'BEARISH'];
  return (
    <div className="flex gap-1.5 mb-4 -mx-4 px-4 overflow-x-auto no-scrollbar">
      {opts.map(o => {
        const isActive = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors
              ${isActive ? 'text-ink' : 'bg-panel border border-border text-gray-300 active:bg-panel2'}`}
            style={isActive ? { background: accent } : undefined}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ===================== Tab screens ===================== */
function FeedScreen({ filter, setFilter, onPredict, tweaks, density }) {
  const filtered = useMemo(() => {
    if (filter === 'ALL') return window.SUBJECTS;
    return window.SUBJECTS.filter(s => s.signal === filter);
  }, [filter]);

  const gap = density === 'compact' ? 'space-y-2.5' : density === 'spacious' ? 'space-y-5' : 'space-y-3.5';

  return (
    <main className="px-4 pt-4 pb-6">
      <SectionHeader title="Live Sentiment Feed" subtitle="8 subjects · refresh 5m" />
      {tweaks.showMarketStrip && <MobileMarketStrip accent={tweaks.accent} />}
      <FilterPills value={filter} onChange={setFilter} accent={tweaks.accent} />

      <div className={gap}>
        {filtered.map((s, i) => (
          <MobileCard key={s.id} subject={s} index={i} onPredict={onPredict} />
        ))}
      </div>

      <div className="text-center text-[10px] text-muted font-mono py-5 mt-2">
        Indexed from 14,028 posts · Aeco Agent v0.4.1
      </div>
    </main>
  );
}

function AgentScreen({ accent }) {
  const heartbeatCount = window.ACTIVITY.filter(a => a.kind === 'heartbeat').length;
  const eventCount = window.ACTIVITY.length;

  return (
    <main className="px-4 pt-4 pb-6">
      <SectionHeader title="Agent Activity" subtitle="indexer telemetry · live" />

      {/* Hero status card */}
      <FadeIn delay={60} y={12} duration={500}
        className="rounded-2xl border border-border bg-panel shadow-card overflow-hidden mb-4"
      >
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }} />
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex">
                <span className="absolute inset-0 rounded-full breathe"></span>
                <span className="relative w-2 h-2 rounded-full bg-bull"></span>
              </span>
              <span className="text-[12px] text-bull font-semibold">Agent Online</span>
            </div>
            <span className="font-mono text-[10px] text-muted">v0.4.1</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-ink/60 ring-1 ring-inset ring-white/[0.04] px-2.5 py-2.5">
              <div className="text-[8.5px] uppercase tracking-[0.16em] text-muted">Heartbeats</div>
              <div className="tnum text-[20px] font-bold text-white leading-none mt-1">
                <CountUp to={52} duration={1100} delay={100} />
              </div>
              <div className="text-[9.5px] text-muted mt-0.5">today</div>
            </div>
            <div className="rounded-lg bg-ink/60 ring-1 ring-inset ring-white/[0.04] px-2.5 py-2.5">
              <div className="text-[8.5px] uppercase tracking-[0.16em] text-muted">Posts</div>
              <div className="tnum text-[20px] font-bold text-white leading-none mt-1">
                <CountUp to={14028} duration={1300} delay={200} />
              </div>
              <div className="text-[9.5px] text-muted mt-0.5">24h indexed</div>
            </div>
            <div className="rounded-lg bg-ink/60 ring-1 ring-inset ring-white/[0.04] px-2.5 py-2.5">
              <div className="text-[8.5px] uppercase tracking-[0.16em] text-muted">Subjects</div>
              <div className="tnum text-[20px] font-bold text-white leading-none mt-1">
                <CountUp to={8} duration={900} delay={300} />
              </div>
              <div className="text-[9.5px] text-muted mt-0.5">tracked</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10.5px] text-muted font-mono">
            <span>Next scan in <span className="text-gray-200">1m 14s</span></span>
            <span>Block #28,401,902</span>
          </div>
        </div>
      </FadeIn>

      <SectionHeader title="Event Log" subtitle={`${eventCount} events · ${heartbeatCount} scans`} />

      <div className="rounded-2xl border border-border bg-panel shadow-card overflow-hidden">
        <div className="px-3 py-1.5">
          {window.ACTIVITY.map((item, i) => (
            <MobileActivityRow key={item.id} item={item} index={i} />
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between text-[10px]">
          <span className="text-muted font-mono">Load older events</span>
          <button className="font-semibold" style={{ color: accent }}>Fetch →</button>
        </div>
      </div>

      <FadeIn delay={500} y={10} duration={500}
        className="mt-4 rounded-2xl p-4"
        style={{
          border: `1px solid ${accent}33`,
          background: `linear-gradient(180deg, ${accent}11 0%, transparent 100%)`,
        }}
      >
        <div className="text-[9.5px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: accent }}>Methodology</div>
        <p className="text-[11.5px] text-gray-300 leading-relaxed">
          The Aeco agent indexes posts across Farcaster, X, and Lens every 5 minutes. Each subject is scored 0–100 by an LLM ensemble weighted by post recency, author reputation, and engagement.
        </p>
      </FadeIn>
    </main>
  );
}

function PredictScreen({ accent }) {
  const myStreak = 3;
  const myRank = 27;
  const myAccuracy = 54;

  return (
    <main className="px-4 pt-4 pb-6">
      <SectionHeader title="Predict" subtitle="earn AEC · build your streak" />

      {/* Streak hero */}
      <FadeIn delay={60} y={12} duration={500}
        className="rounded-2xl p-4 mb-4 overflow-hidden relative"
        style={{
          border: `1px solid ${accent}33`,
          background: `linear-gradient(180deg, ${accent}14 0%, transparent 100%)`,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[9.5px] uppercase tracking-[0.18em] font-bold" style={{ color: accent }}>Your Streak</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[42px] font-bold text-white leading-none tnum">
                <CountUp to={myStreak} duration={900} delay={120} />
              </span>
              <span className="text-orange-300 text-[26px]">🔥</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">2 more for 2× rewards</div>
          </div>
          <div className="text-right">
            <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted">Rank</div>
            <div className="text-[22px] font-bold text-white tnum mt-0.5">#{myRank}</div>
            <div className="text-[10px] text-muted mt-0.5 tnum">{myAccuracy}% accuracy</div>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-3">
          {[1,2,3,4,5].map(n => (
            <div key={n} className="flex-1 h-1.5 rounded-full" style={{
              background: n <= myStreak ? accent : 'rgba(255,255,255,0.10)',
              boxShadow: n <= myStreak ? `0 0 8px ${accent}66` : 'none',
            }}></div>
          ))}
        </div>

        <button
          className="w-full py-2.5 rounded-lg text-[12px] font-semibold transition-colors text-ink"
          style={{ background: accent }}
        >
          Make a prediction →
        </button>
      </FadeIn>

      <SectionHeader title="Top Predictors" subtitle="week 14 · pool 12,840 AEC" />

      <div className="rounded-2xl border border-border bg-panel shadow-card overflow-hidden mb-4">
        <div className="px-2 py-2">
          <div className="flex items-center gap-2.5 px-2.5 pb-1 text-[8.5px] uppercase tracking-[0.16em] text-muted font-semibold">
            <div className="w-5 text-center">#</div>
            <div className="flex-1">Address</div>
            <div className="w-10 text-right">Streak</div>
            <div className="w-10 text-right">Acc.</div>
          </div>
          {window.LEADERBOARD.map((row, i) => (
            <MobileLeaderRow key={row.rank} row={row} index={i} />
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between text-[10px]">
          <span className="text-muted">Pool: <span className="font-semibold tnum" style={{ color: accent }}>12,840 AEC</span></span>
          <button className="font-semibold" style={{ color: accent }}>Full board →</button>
        </div>
      </div>

      <SectionHeader title="Recent Wins" subtitle="last 24h" />

      <div className="space-y-2">
        {[
          { addr: '0x7a3f…b1c4', subject: 'ETH', side: 'LOWER', earn: 20, signal: '#ef4444' },
          { addr: '0x2e91…ff08', subject: 'Africa Crypto', side: 'HIGHER', earn: 10, signal: '#22c55e' },
          { addr: '0xc4d0…7e22', subject: 'Vitalik', side: 'HIGHER', earn: 20, signal: '#22c55e' },
        ].map((w, i) => (
          <FadeIn key={i} delay={200 + i * 80} y={8} duration={420}
            className="rounded-xl border border-border bg-panel/80 px-3.5 py-2.5 flex items-center gap-3"
          >
            <div className="w-2 h-10 rounded-full" style={{ background: w.signal, boxShadow: `0 0 10px ${w.signal}66` }}></div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11.5px] text-gray-200 truncate">{w.addr}</div>
              <div className="text-[10.5px] text-muted">
                Predicted <span className="font-semibold" style={{ color: w.signal }}>{w.side}</span> on {w.subject}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-bold tnum" style={{ color: accent }}>+{w.earn}</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-muted font-semibold">AEC</div>
            </div>
          </FadeIn>
        ))}
      </div>
    </main>
  );
}

function WalletScreen({ accent, balance }) {
  const [showHowToEarn, setShowHowToEarn] = useState(false);
  return (
    <main className="px-4 pt-4 pb-6">
      <SectionHeader title="Wallet" subtitle="not connected" />

      <FadeIn delay={60} y={12} duration={500}
        className="rounded-2xl p-5 overflow-hidden relative"
        style={{
          border: `1px solid ${accent}33`,
          background: `linear-gradient(135deg, ${accent}1a 0%, transparent 70%), #13131c`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-2" style={{ color: accent }}>AEC Balance</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="tnum text-[44px] font-bold text-white leading-none">
            <CountUp to={balance} duration={1200} delay={100} />
          </span>
          <span className="text-[14px] text-muted font-semibold">AEC</span>
        </div>
        <div className="text-[12px] text-gray-400 mb-4">≈ $128.40 USD · earned this week +84 AEC</div>
        <div className="grid grid-cols-2 gap-2">
          <button className="py-2.5 rounded-lg text-[12px] font-semibold text-ink" style={{ background: accent }}>
            Connect Wallet
          </button>
          <button onClick={() => setShowHowToEarn(true)} className="py-2.5 rounded-lg text-[12px] font-semibold text-gray-200 bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] active:bg-white/[0.08]">
            How to earn
          </button>
        </div>
      </FadeIn>
      {showHowToEarn && <HowToEarnModal onClose={() => setShowHowToEarn(false)} />}

      <div className="mt-6 text-[11px] text-muted text-center font-mono">
        Connect your Celo wallet to claim AEC rewards.
      </div>
    </main>
  );
}

/* ===================== Bottom tab bar ===================== */
function BottomTabBar({ active, onChange, accent }) {
  const tabs = [
    { id: 'feed',   label: 'Feed',   icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2.5" y="3" width="13" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.4"/><rect x="2.5" y="8" width="13" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.4"/><rect x="2.5" y="13" width="13" height="2" rx="0.8" stroke="currentColor" strokeWidth="1.4"/></svg> },
    { id: 'predict',label: 'Predict',icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 14V8M9 14V4M15 14V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { id: 'agent',  label: 'Agent',  icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M9 5.5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
    { id: 'wallet', label: 'Wallet', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2.5" y="4.5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="12" cy="9.5" r="1" fill="currentColor"/></svg> },
  ];
  return (
    <div className="sticky bottom-0 z-20 backdrop-blur-xl bg-ink/85 border-t border-border">
      <div className="grid grid-cols-4 px-2 pt-1.5 pb-1">
        {tabs.map(t => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex flex-col items-center gap-0.5 py-1.5 transition-colors"
              style={{ color: isActive ? accent : '#6b7280' }}
            >
              {t.icon}
              <span className="text-[9.5px] font-semibold tracking-wide uppercase">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[24px]"></div>
    </div>
  );
}

/* ===================== Root app ===================== */
function MobileApp({ t, setTweak }) {
  const [activeTab, setActiveTab] = useState('feed');
  const [modalSubject, setModalSubject] = useState(() => t.openModalOnLaunch ? window.SUBJECTS[0] : null);
  const [filter, setFilter] = useState('ALL');

  // animation speed CSS variable on root
  const speed = useMemo(() => Math.max(0.2, t.animationSpeed || 1), [t.animationSpeed]);

  const handlePredict = (subject) => {
    setModalSubject(subject);
  };

  const goToTab = (tab) => {
    setActiveTab(tab);
    // close modal when switching tabs
    setModalSubject(null);
  };

  return (
    <div
      className="relative w-full h-full bg-ink overflow-hidden flex flex-col"
      style={{ '--anim-speed': speed }}
    >
      {/* Status bar safe area spacer */}
      <div className="shrink-0" style={{ height: 54 }}></div>

      {/* Ambient glow */}
      {t.showAmbientGlow && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-20 w-[320px] h-[320px] rounded-full drift"
            style={{ background: `radial-gradient(circle, ${t.accent}14 0%, transparent 70%)` }}></div>
          <div className="absolute top-1/3 -right-24 w-[280px] h-[280px] rounded-full drift"
            style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)', animationDelay: '4s' }}></div>
        </div>
      )}

      {/* Scroll container */}
      <div className={`relative flex-1 overflow-y-auto scroll-thin ${t.showDottedBg ? 'bg-grid' : ''}`}>
        <MobileTopNav balance={1284} lastScan="4m ago" accent={t.accent} />

        {activeTab === 'feed' && (
          <FeedScreen
            filter={filter}
            setFilter={setFilter}
            onPredict={handlePredict}
            tweaks={t}
            density={t.density}
          />
        )}
        {activeTab === 'agent'   && <AgentScreen accent={t.accent} />}
        {activeTab === 'predict' && <PredictScreen accent={t.accent} />}
        {activeTab === 'wallet'  && <WalletScreen accent={t.accent} balance={1284} />}
      </div>

      <BottomTabBar active={activeTab} onChange={goToTab} accent={t.accent} />

      <MobilePredictionModal subject={modalSubject} onClose={() => setModalSubject(null)} />

      {/* Tweaks panel (lives outside the device — see Page) */}
    </div>
  );
}

function Page() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <>
      <IOSDevice width={390} height={844} dark={true}>
        <MobileApp t={t} setTweak={setTweak} />
      </IOSDevice>

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
              { value: 'compact', label: 'Compact' },
              { value: 'comfy',   label: 'Comfy'   },
              { value: 'spacious',label: 'Roomy'   },
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
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
