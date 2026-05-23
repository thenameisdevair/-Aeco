// Tiny motion shim — replaces framer-motion for our limited needs.
// Supports: <FadeIn delay y duration>, <Reveal/> wrapper, and an animated path via React state.

const { useState, useEffect, useRef, useMemo } = React;

// ---------- FadeIn primitive ----------
function FadeIn({ children, delay = 0, y = 8, x = 0, duration = 500, className = '', style = {}, as: As = 'div', ...rest }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <As
      className={className}
      style={{
        ...style,
        opacity: on ? 1 : 0,
        transform: on ? 'translate3d(0,0,0)' : `translate3d(${x}px, ${y}px, 0)`,
        transition: `opacity ${duration}ms cubic-bezier(.2,.7,.3,1) ${0}ms, transform ${duration}ms cubic-bezier(.2,.7,.3,1) ${0}ms`,
        willChange: 'opacity, transform',
      }}
      {...rest}
    >
      {children}
    </As>
  );
}

// ---------- Signal helpers ----------
const signalColor = (s) => s === 'BULLISH' ? '#22c55e' : s === 'BEARISH' ? '#ef4444' : '#9ca3af';
const signalBg    = (s) => s === 'BULLISH' ? 'rgba(34,197,94,0.10)' : s === 'BEARISH' ? 'rgba(239,68,68,0.10)' : 'rgba(156,163,175,0.08)';
const signalRing  = (s) => s === 'BULLISH' ? 'rgba(34,197,94,0.30)' : s === 'BEARISH' ? 'rgba(239,68,68,0.30)' : 'rgba(156,163,175,0.20)';

// ---------- Count-up number ----------
function CountUp({ to, duration = 1200, delay = 0, className = '' }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start;
    let raf;
    const tick = (t) => {
      if (!start) start = t;
      const elapsed = t - start - delay;
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay]);
  return <span className={`tnum ${className}`}>{v}</span>;
}

// ---------- Arc gauge (animated via dashoffset transition) ----------
function ArcGauge({ value, color = '#f5c842', size = 132, stroke = 8, delay = 0 }) {
  const r = (size - stroke) / 2;
  const totalDeg = 240;
  const startDeg = -210;
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = ((startDeg + totalDeg) * Math.PI) / 180;
  const cx = size / 2, cy = size / 2;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = totalDeg > 180 ? 1 : 0;
  const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  const C = (Math.PI * 2 * r) * (totalDeg / 360);
  const targetOffset = C * (1 - value / 100);

  const [offset, setOffset] = useState(C);
  useEffect(() => {
    const t = setTimeout(() => setOffset(targetOffset), delay);
    return () => clearTimeout(t);
  }, [targetOffset, delay]);

  const gid = useMemo(() => `g-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="no-select">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <path d={path} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
      <path
        d={path}
        stroke={`url(#${gid})`}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1300ms cubic-bezier(.2,.7,.3,1)' }}
      />
      {[0, 0.5, 1].map((t, i) => {
        const a = startRad + (endRad - startRad) * t;
        const rInner = r - stroke;
        const rOuter = r + stroke - 2;
        const xa = cx + rInner * Math.cos(a);
        const ya = cy + rInner * Math.sin(a);
        const xb = cx + rOuter * Math.cos(a);
        const yb = cy + rOuter * Math.sin(a);
        return <line key={i} x1={xa} y1={ya} x2={xb} y2={yb} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

// ---------- Category badge ----------
function CategoryBadge({ category }) {
  const styles = {
    ASSET:     'text-gold/90 bg-gold/[0.06] ring-gold/20',
    PERSON:    'text-indigo-300 bg-indigo-400/[0.06] ring-indigo-400/20',
    NARRATIVE: 'text-fuchsia-300 bg-fuchsia-400/[0.06] ring-fuchsia-400/20',
  };
  return (
    <span className={`tracking-[0.14em] text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${styles[category] || styles.ASSET}`}>
      {category}
    </span>
  );
}

// ---------- Signal badge ----------
function SignalBadge({ signal }) {
  const c = signalColor(signal);
  const arrow = signal === 'BULLISH' ? '↑' : signal === 'BEARISH' ? '↓' : '–';
  return (
    <span
      className="tracking-[0.14em] text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ring-inset inline-flex items-center gap-1"
      style={{ color: c, background: signalBg(signal), boxShadow: `inset 0 0 0 1px ${signalRing(signal)}` }}
    >
      <span className="text-[11px] leading-none">{arrow}</span>{signal}
    </span>
  );
}

// ---------- Confidence bar ----------
function ConfidenceBar({ value, color = '#f5c842', delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">Confidence</span>
        <span className="text-[11px] tnum text-gray-300 font-semibold">{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden relative">
        <div
          style={{
            width: `${w}%`,
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            boxShadow: `0 0 12px ${color}55`,
            transition: 'width 1200ms cubic-bezier(.2,.7,.3,1)',
          }}
          className="absolute inset-y-0 left-0 rounded-full"
        />
      </div>
    </div>
  );
}

// ---------- Sentiment card ----------
function SentimentCard({ subject, index, onPredict }) {
  if (!subject) return null;

  const signal     = subject.signal     ?? 'NEUTRAL';
  const score      = subject.score      ?? 0;
  const confidence = subject.confidence ?? 0;
  const summary    = subject.summary    ?? '';
  const updated    = subject.updated    ?? 'unknown';
  const name       = subject.name       ?? 'Unknown';
  const category   = subject.category   ?? 'ASSET';
  const delta      = subject.delta      ?? 0;

  const color      = signalColor(signal);
  const deltaColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#6b7280';
  const deltaArrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '·';

  return (
    <FadeIn delay={60 + index * 60} y={16} duration={520} className="card-lift relative rounded-xl border border-border bg-panel shadow-card overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[15px] font-semibold text-white truncate">{name}</h3>
              <CategoryBadge category={category} />
            </div>
            <div className="font-mono text-[11px] text-muted truncate">{subject.ticker}</div>
          </div>
          <SignalBadge signal={signal} />
        </div>

        {/* Middle: gauge + score */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
            <ArcGauge value={score} color={color} delay={200 + index * 60} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium mt-3">Score</div>
              <div className="tnum text-[44px] leading-none font-bold text-white mt-0.5">
                <CountUp to={score} duration={1300} delay={200 + index * 60} />
              </div>
              <div className="tnum text-[11px] mt-1.5 font-semibold" style={{ color: deltaColor }}>
                {deltaArrow} {Math.abs(delta)} 24h
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3.5">
            <ConfidenceBar value={confidence} color={color} delay={400 + index * 60} />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-2.5 py-1.5">
                <div className="text-[9px] uppercase tracking-[0.16em] text-muted">Posts</div>
                <div className="tnum text-[13px] text-gray-200 font-semibold">{subject.posts?.toLocaleString() ?? '0'}</div>
              </div>
              <div className="rounded-md bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-2.5 py-1.5">
                <div className="text-[9px] uppercase tracking-[0.16em] text-muted">Updated</div>
                <div className="text-[12px] text-gray-200 font-medium">{updated}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <p className="text-[12.5px] leading-relaxed text-gray-400 italic mb-4 min-h-[34px]">
          "{summary}"
        </p>

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-bull/70"></span>
            <span>Last scan {updated}</span>
          </div>
          <button
            onClick={() => onPredict(subject)}
            className="group inline-flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide
                       text-gold border border-gold/40 rounded-md px-2.5 py-1.5
                       hover:bg-gold hover:text-ink hover:border-gold transition-colors"
          >
            <span>Predict</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </div>
    </FadeIn>
  );
}

// ---------- Section header ----------
function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
      <div>
        <div className="flex items-center gap-3 mb-1.5 flex-wrap">
          <h2 className="text-xl font-semibold text-white tracking-tight">{title}</h2>
          {subtitle && <span className="text-[11px] text-muted font-mono">{subtitle}</span>}
        </div>
        <div className="h-px w-40 gradient-underline rounded-full"></div>
      </div>
      {right}
    </div>
  );
}

// ---------- Activity row ----------
function ActivityRow({ item, index }) {
  const isHeartbeat = item.kind === 'heartbeat';
  const isBull = item.kind === 'bullish';
  const isBear = item.kind === 'bearish';
  const dotColor = isBull ? '#22c55e' : isBear ? '#ef4444' : isHeartbeat ? '#6b7280' : '#f5c842';

  return (
    <FadeIn delay={300 + index * 50} x={-8} y={0} duration={420}
      className="relative flex items-start gap-3 py-2.5 pl-3 pr-2 -mx-2 rounded-md hover:bg-white/[0.02]"
    >
      <div className="absolute left-[14px] top-0 bottom-0 w-px bg-white/[0.04]"></div>
      <div className="relative z-10 mt-1.5">
        <span className="block w-2 h-2 rounded-full" style={{ background: dotColor, boxShadow: isHeartbeat ? 'none' : `0 0 10px ${dotColor}aa` }}></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[12.5px] leading-snug ${isHeartbeat ? 'text-gray-400' : 'text-gray-200 font-medium'}`}>
          {item.text}
        </div>
        {item.sub && (
          <div className="text-[10.5px] uppercase tracking-[0.14em] mt-0.5 font-semibold" style={{ color: dotColor }}>
            {item.sub}
          </div>
        )}
      </div>
      <div className="text-[10.5px] text-muted tnum whitespace-nowrap mt-1">{item.time}</div>
    </FadeIn>
  );
}

// ---------- Leaderboard row ----------
function LeaderRow({ row, index }) {
  const medal = ['#f5c842', '#cbd5e1', '#b87333'][row.rank - 1];
  return (
    <FadeIn delay={400 + index * 50} y={6} duration={380}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md ${row.you ? 'bg-gold/[0.06] ring-1 ring-inset ring-gold/20' : 'hover:bg-white/[0.02]'}`}
    >
      <div className="w-6 text-center">
        {medal ? (
          <span className="tnum text-[13px] font-bold" style={{ color: medal }}>{row.rank}</span>
        ) : (
          <span className="tnum text-[12px] text-muted">{row.rank}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-mono text-[12px] text-gray-200 truncate">{row.addr}</span>
        {row.you && <span className="text-[9px] uppercase tracking-[0.16em] text-gold font-bold px-1 py-0.5 rounded bg-gold/10">You</span>}
      </div>
      <div className="flex items-center gap-1 text-[12px] font-semibold text-orange-300">
        <span>🔥</span><span className="tnum">{row.streak}</span>
      </div>
      <div className="tnum text-[12px] text-gray-300 font-semibold w-12 text-right">{row.accuracy}%</div>
    </FadeIn>
  );
}

// ---------- Faucet Banner ----------
function FaucetBanner({ userAddress, onClaimed }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [txHash, setTxHash] = useState('');

  async function claim() {
    setStatus('loading');
    try {
      const res = await fetch('https://aeco.onrender.com/faucet', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wallet: userAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTxHash(data.txHash);
      setStatus('success');
      onClaimed?.();
    } catch (err) {
      setStatus('error');
      console.error('[faucet]', err.message);
    }
  }

  if (status === 'success') return (
    <div className="rounded-lg bg-bull/10 border border-bull/30 px-3.5 py-3 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[12.5px] text-bull font-medium">
        <span>✓</span>
        <span>0.1 CELO sent — you can now make predictions</span>
      </div>
      <a
        href={`https://celoscan.io/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold whitespace-nowrap"
        style={{ color: '#f5c842' }}
      >
        View tx →
      </a>
    </div>
  );

  return (
    <div className="rounded-lg border px-3.5 py-3 mb-4" style={{ background: 'rgba(245,200,66,0.05)', borderColor: 'rgba(245,200,66,0.25)' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-medium" style={{ color: '#f5c842' }}>
          You need CELO for gas fees
        </span>
        <button
          onClick={claim}
          disabled={status === 'loading'}
          className="shrink-0 rounded-md text-[11.5px] font-semibold px-3 py-1.5 transition"
          style={{ background: '#f5c842', color: '#0a0a0f', opacity: status === 'loading' ? 0.6 : 1, cursor: status === 'loading' ? 'not-allowed' : 'pointer' }}
        >
          {status === 'loading' ? 'Sending… (up to 60s)' : 'Claim 0.1 CELO →'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-[11px] mt-2" style={{ color: '#ef4444' }}>
          Already claimed or faucet empty. Try another wallet.
        </p>
      )}
    </div>
  );
}

// ---------- Prediction Modal ----------
function PredictionModal({ subject, onClose }) {
  if (!subject) return null;
  const [mounted, setMounted] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [celoBalance, setCeloBalance] = useState(null); // BigInt wei, null = unknown
  const [walletAddr, setWalletAddr] = useState(null);

  useEffect(() => {
    if (subject) {
      setTxStatus(null);
      setTxHash(null);
      setCeloBalance(null);
      setWalletAddr(null);
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    } else {
      setMounted(false);
      setTxStatus(null);
      setTxHash(null);
    }
  }, [subject]);

  useEffect(() => {
    if (!subject || !window.ethereum) return;
    (async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const addr = accounts?.[0];
        if (!addr) return;
        setWalletAddr(addr);
        const hex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [addr, 'latest'],
        });
        setCeloBalance(BigInt(hex));
      } catch {
        // ignore — banner simply won't show
      }
    })();
  }, [subject]);

  useEffect(() => {
    if (!subject) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [subject, onClose]);

  if (!subject) return null;
  const color = signalColor(subject.signal);

  async function handleVote(direction) {
    setTxStatus('pending');
    try {
      const hash = await window.AecoData.makePrediction(subject.id, direction);
      setTxHash(hash);
      setTxStatus('success');
      // After prediction tx confirms
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const userAddress = accounts?.[0];
        await window.AecoData.submitUserFeedback(userAddress, 85);
        console.log('[feedback] User feedback submitted to ERC-8004');
      } catch (e) {
        // Silent fail — don't block the user experience
        console.warn('[feedback] Feedback submission skipped:', e.message);
      }
    } catch(err) {
      console.error(err);
      setTxStatus('error');
    }
  }

  const modalShell = (children) => (
    <div
      className="fixed inset-0 z-50 modal-backdrop bg-black/70 flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 240ms ease' }}
      onClick={onClose}
    >
      <div
        className="relative w-full md:max-w-md rounded-t-2xl md:rounded-2xl bg-panel border border-border2 shadow-2xl overflow-hidden"
        style={{
          transform: mounted ? 'translate3d(0,0,0) scale(1)' : 'translate3d(0, 60px, 0) scale(0.97)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 420ms cubic-bezier(.22,1.2,.36,1), opacity 280ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (txStatus === 'success') {
    return modalShell(
      <div className="px-6 pt-8 pb-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-bull/20 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-1">Prediction Submitted</h3>
        <p className="text-[13px] text-gray-400 mb-4">Your prediction has been recorded on-chain.</p>
        {txHash && (
          <div className="w-full rounded-lg bg-ink/60 border border-white/[0.05] px-4 py-3 mb-4 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold mb-1">Transaction</div>
            <div className="font-mono text-[12px] text-gray-200 mb-2">
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </div>
            <a
              href={`https://celoscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] font-semibold"
              style={{ color: '#f5c842' }}
            >
              View on Celoscan →
            </a>
          </div>
        )}
        <p className="text-[11.5px] text-muted mb-4">
          Come back in 24h — the agent will auto-resolve your prediction and mint your AEC if correct.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-lg py-3 text-[13px] font-semibold tracking-wide bg-white/[0.06] text-gray-200 hover:bg-white/[0.10] transition"
        >
          Close
        </button>
      </div>
    );
  }

  const isPending = txStatus === 'pending';

  return modalShell(
    <>
      <div className="md:hidden flex justify-center pt-2.5 pb-1">
        <div className="w-10 h-1 rounded-full bg-white/15"></div>
      </div>

      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

      <div className="px-6 pt-5 pb-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted font-semibold">Predict Sentiment</div>
          <button onClick={onClose} className="text-muted hover:text-white w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.05] transition">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <h3 className="text-2xl font-bold text-white tracking-tight mb-1">{subject.name}</h3>
        <div className="font-mono text-[11px] text-muted mb-5 flex items-center gap-2">
          <span>{subject.ticker}</span>
          <span className="opacity-30">·</span>
          <CategoryBadge category={subject.category} />
        </div>

        <div className="rounded-xl bg-ink/60 border border-white/[0.05] p-4 mb-5 flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
            <ArcGauge value={subject.score} color={color} size={76} stroke={5} delay={120} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="tnum text-[20px] font-bold text-white mt-1.5">{subject.score}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold mb-1">Current Score</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tnum text-[22px] font-bold text-white">{subject.score}</span>
              <SignalBadge signal={subject.signal} />
            </div>
            <div className="text-[11px] text-muted mt-1">Confidence {subject.confidence}% · {subject.posts?.toLocaleString() ?? '0'} posts</div>
          </div>
        </div>

        <p className="text-[14px] text-gray-200 leading-snug mb-4">
          Will the sentiment score be <span className="font-semibold">higher</span> or <span className="font-semibold">lower</span> in 24 hours?
        </p>

        {celoBalance !== null && celoBalance < 50000000000000000n && (
          <FaucetBanner
            userAddress={walletAddr}
            onClaimed={() => setCeloBalance(null)}
          />
        )}

        {txStatus === 'error' && (
          <div className="mb-4 rounded-lg bg-bear/10 border border-bear/30 px-3.5 py-3 text-[12.5px] text-bear">
            Transaction failed. Please try again.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => !isPending && handleVote(1)}
            disabled={isPending}
            className={`group relative rounded-xl border-2 py-4 px-3 transition-all
              ${isPending ? 'border-bull/20 bg-bull/5 cursor-not-allowed opacity-60' : 'border-bull/40 hover:border-bull hover:bg-bull/10'}`}
          >
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4 text-bull" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-[11px] text-bull font-semibold">Pending…</span>
              </div>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-bull mb-1">Higher</div>
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-bull">
                  <span>↑</span><span>{subject.score + 1}+</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">More bullish in 24h</div>
              </>
            )}
          </button>
          <button
            onClick={() => !isPending && handleVote(2)}
            disabled={isPending}
            className={`group relative rounded-xl border-2 py-4 px-3 transition-all
              ${isPending ? 'border-bear/20 bg-bear/5 cursor-not-allowed opacity-60' : 'border-bear/40 hover:border-bear hover:bg-bear/10'}`}
          >
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4 text-bear" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-[11px] text-bear font-semibold">Pending…</span>
              </div>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-bear mb-1">Lower</div>
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-bear">
                  <span>↓</span><span>{subject.score - 1}-</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">More bearish in 24h</div>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-3.5 py-3 gap-3">
          <div className="text-[11.5px] text-gray-400 leading-snug">
            Correct predictions earn <span className="text-gold font-semibold">10 AEC</span>. Streak of 5+ earns <span className="text-gold font-semibold">double</span>.
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Your streak</div>
            <div className="text-[16px] font-bold text-orange-300 flex items-center gap-1 justify-end">
              <span>🔥</span><span className="tnum">3</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function HowToEarnModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/60" onClick={onClose}>
      <div className="relative w-full max-w-md mx-4 bg-panel rounded-2xl ring-1 ring-white/10 p-6" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">✕</button>
        <h2 className="text-white font-bold text-lg mb-1">How to earn AEC</h2>
        <p className="text-gray-400 text-sm mb-5">Aeco rewards you for using the oracle correctly.</p>

        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="text-gold font-bold text-sm mt-0.5">01</span>
            <div>
              <p className="text-white text-sm font-semibold">Make a prediction</p>
              <p className="text-gray-400 text-xs mt-0.5">Pick HIGHER or LOWER on any sentiment subject. Each prediction costs nothing — just gas.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-gold font-bold text-sm mt-0.5">02</span>
            <div>
              <p className="text-white text-sm font-semibold">Wait for resolution</p>
              <p className="text-gray-400 text-xs mt-0.5">The agent posts a new score every 2 hours. Predictions resolve automatically when the next score arrives.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-gold font-bold text-sm mt-0.5">03</span>
            <div>
              <p className="text-white text-sm font-semibold">Earn AEC tokens</p>
              <p className="text-gray-400 text-xs mt-0.5">Correct predictions earn 10–20 AEC. Build a streak for bonus multipliers. Wrong predictions cost 5 AEC.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-gold font-bold text-sm mt-0.5">04</span>
            <div>
              <p className="text-white text-sm font-semibold">Need gas? Claim CELO</p>
              <p className="text-gray-400 text-xs mt-0.5">First time? Open any prediction and claim 0.1 CELO from the faucet to cover gas fees.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 text-xs text-gray-500 text-center">
          AEC is the Aeco oracle token · Deployed on Celo Mainnet
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  FadeIn, CountUp, ArcGauge, CategoryBadge, SignalBadge, ConfidenceBar,
  SentimentCard, SectionHeader, ActivityRow, LeaderRow, PredictionModal,
  HowToEarnModal,
  signalColor, signalBg, signalRing,
});
