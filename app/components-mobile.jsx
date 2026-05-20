// Mobile components — same building blocks, tighter sizing for 390px iPhone width.

const { useState, useEffect, useRef, useMemo } = React;

function FadeIn({ children, delay = 0, y = 8, x = 0, duration = 480, className = '', style = {}, as: As = 'div', ...rest }) {
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
        transition: `opacity ${duration}ms cubic-bezier(.2,.7,.3,1), transform ${duration}ms cubic-bezier(.2,.7,.3,1)`,
        willChange: 'opacity, transform',
      }}
      {...rest}
    >
      {children}
    </As>
  );
}

const signalColor = (s) => s === 'BULLISH' ? '#22c55e' : s === 'BEARISH' ? '#ef4444' : '#9ca3af';
const signalBg    = (s) => s === 'BULLISH' ? 'rgba(34,197,94,0.10)' : s === 'BEARISH' ? 'rgba(239,68,68,0.10)' : 'rgba(156,163,175,0.08)';
const signalRing  = (s) => s === 'BULLISH' ? 'rgba(34,197,94,0.30)' : s === 'BEARISH' ? 'rgba(239,68,68,0.30)' : 'rgba(156,163,175,0.20)';

function CountUp({ to, duration = 1200, delay = 0, className = '' }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start, raf;
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

function ArcGauge({ value, color = '#f5c842', size = 116, stroke = 7, delay = 0 }) {
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
  const path = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  const C = (Math.PI * 2 * r) * (totalDeg / 360);
  const targetOffset = C * (1 - value / 100);

  const [offset, setOffset] = useState(C);
  useEffect(() => {
    const t = setTimeout(() => setOffset(targetOffset), delay);
    return () => clearTimeout(t);
  }, [targetOffset, delay]);

  const gid = useMemo(() => `gm-${Math.random().toString(36).slice(2, 8)}`, []);

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

function CategoryBadge({ category }) {
  const styles = {
    ASSET:     'text-gold/90 bg-gold/[0.06] ring-gold/20',
    PERSON:    'text-indigo-300 bg-indigo-400/[0.06] ring-indigo-400/20',
    NARRATIVE: 'text-fuchsia-300 bg-fuchsia-400/[0.06] ring-fuchsia-400/20',
  };
  return (
    <span className={`tracking-[0.14em] text-[9.5px] font-semibold px-1.5 py-0.5 rounded ring-1 ring-inset ${styles[category] || styles.ASSET}`}>
      {category}
    </span>
  );
}

function SignalBadge({ signal }) {
  const c = signalColor(signal);
  const arrow = signal === 'BULLISH' ? '↑' : signal === 'BEARISH' ? '↓' : '–';
  return (
    <span
      className="tracking-[0.14em] text-[9.5px] font-bold px-1.5 py-0.5 rounded ring-1 ring-inset inline-flex items-center gap-1"
      style={{ color: c, background: signalBg(signal), boxShadow: `inset 0 0 0 1px ${signalRing(signal)}` }}
    >
      <span className="text-[11px] leading-none">{arrow}</span>{signal}
    </span>
  );
}

function ConfidenceBar({ value, color = '#f5c842', delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9.5px] uppercase tracking-[0.16em] text-muted font-medium">Confidence</span>
        <span className="text-[10.5px] tnum text-gray-300 font-semibold">{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden relative">
        <div
          style={{
            width: `${w}%`,
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            boxShadow: `0 0 10px ${color}55`,
            transition: 'width 1200ms cubic-bezier(.2,.7,.3,1)',
          }}
          className="absolute inset-y-0 left-0 rounded-full"
        />
      </div>
    </div>
  );
}

function MobileCard({ subject, index, onPredict }) {
  const color = signalColor(subject.signal);
  const deltaColor = subject.delta > 0 ? '#22c55e' : subject.delta < 0 ? '#ef4444' : '#6b7280';
  const deltaArrow = subject.delta > 0 ? '▲' : subject.delta < 0 ? '▼' : '·';

  return (
    <FadeIn
      delay={80 + index * 70}
      y={14}
      duration={520}
      className="card-tap relative rounded-2xl border border-border bg-panel shadow-card overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}55, transparent)` }} />

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-white leading-tight truncate">{subject.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <CategoryBadge category={subject.category} />
              <span className="font-mono text-[10.5px] text-muted truncate">{subject.ticker}</span>
            </div>
          </div>
          <SignalBadge signal={subject.signal} />
        </div>

        {/* Middle: gauge + stats */}
        <div className="flex items-center gap-3 mb-3.5">
          <div className="relative shrink-0" style={{ width: 116, height: 116 }}>
            <ArcGauge value={subject.score} color={color} size={116} stroke={7} delay={220 + index * 70} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[9px] uppercase tracking-[0.16em] text-muted font-medium mt-2.5">Score</div>
              <div className="tnum text-[38px] leading-none font-bold text-white mt-0.5">
                <CountUp to={subject.score} duration={1300} delay={220 + index * 70} />
              </div>
              <div className="tnum text-[10.5px] mt-1 font-semibold" style={{ color: deltaColor }}>
                {deltaArrow} {Math.abs(subject.delta)} 24h
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-2.5">
            <ConfidenceBar value={subject.confidence} color={color} delay={420 + index * 70} />
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-2 py-1.5">
                <div className="text-[8.5px] uppercase tracking-[0.14em] text-muted">Posts</div>
                <div className="tnum text-[12px] text-gray-200 font-semibold">{subject.posts.toLocaleString()}</div>
              </div>
              <div className="rounded-md bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-2 py-1.5">
                <div className="text-[8.5px] uppercase tracking-[0.14em] text-muted">Updated</div>
                <div className="text-[11px] text-gray-200 font-medium truncate">{subject.updated}</div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[12px] leading-snug text-gray-400 italic mb-3 min-h-[32px]">
          "{subject.summary}"
        </p>

        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-bull/70"></span>
            <span>Scan {subject.updated}</span>
          </div>
          <button
            onClick={() => onPredict(subject)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide
                       text-gold border border-gold/40 rounded-md px-2.5 py-1.5
                       active:bg-gold active:text-ink transition-colors"
          >
            <span>Predict</span><span>→</span>
          </button>
        </div>
      </div>
    </FadeIn>
  );
}

function MobileActivityRow({ item, index }) {
  const isHeartbeat = item.kind === 'heartbeat';
  const isBull = item.kind === 'bullish';
  const isBear = item.kind === 'bearish';
  const dotColor = isBull ? '#22c55e' : isBear ? '#ef4444' : isHeartbeat ? '#6b7280' : '#f5c842';
  return (
    <FadeIn delay={200 + index * 40} x={-6} y={0} duration={400}
      className="relative flex items-start gap-2.5 py-2 pl-2 pr-1"
    >
      <div className="absolute left-[10px] top-0 bottom-0 w-px bg-white/[0.04]"></div>
      <div className="relative z-10 mt-1">
        <span className="block w-1.5 h-1.5 rounded-full" style={{ background: dotColor, boxShadow: isHeartbeat ? 'none' : `0 0 8px ${dotColor}aa` }}></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[11.5px] leading-snug ${isHeartbeat ? 'text-gray-400' : 'text-gray-200 font-medium'}`}>
          {item.text}
        </div>
        {item.sub && (
          <div className="text-[9.5px] uppercase tracking-[0.14em] mt-0.5 font-semibold" style={{ color: dotColor }}>
            {item.sub}
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted tnum whitespace-nowrap mt-0.5">{item.time}</div>
    </FadeIn>
  );
}

function MobileLeaderRow({ row, index }) {
  const medal = ['#f5c842', '#cbd5e1', '#b87333'][row.rank - 1];
  return (
    <FadeIn delay={300 + index * 40} y={6} duration={380}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md ${row.you ? 'bg-gold/[0.06] ring-1 ring-inset ring-gold/20' : ''}`}
    >
      <div className="w-5 text-center">
        {medal ? (
          <span className="tnum text-[12px] font-bold" style={{ color: medal }}>{row.rank}</span>
        ) : (
          <span className="tnum text-[11px] text-muted">{row.rank}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="font-mono text-[11.5px] text-gray-200 truncate">{row.addr}</span>
        {row.you && <span className="text-[8.5px] uppercase tracking-[0.16em] text-gold font-bold px-1 py-0.5 rounded bg-gold/10">You</span>}
      </div>
      <div className="flex items-center gap-0.5 text-[11.5px] font-semibold text-orange-300">
        <span>🔥</span><span className="tnum">{row.streak}</span>
      </div>
      <div className="tnum text-[11.5px] text-gray-300 font-semibold w-10 text-right">{row.accuracy}%</div>
    </FadeIn>
  );
}

// ---------- Full-screen bottom sheet modal ----------
function MobilePredictionModal({ subject, onClose }) {
  const [choice, setChoice] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (subject) {
      setChoice(null);
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    } else {
      setMounted(false);
    }
  }, [subject]);

  if (!subject) return null;
  const color = signalColor(subject.signal);

  return (
    <div
      className="absolute inset-0 z-50 modal-backdrop bg-black/70 flex items-end justify-center"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 220ms ease' }}
      onClick={onClose}
    >
      <div
        className="relative w-full bg-panel border-t border-border2 shadow-2xl rounded-t-3xl overflow-hidden"
        style={{
          height: '92%',
          transform: mounted ? 'translate3d(0,0,0)' : 'translate3d(0, 100%, 0)',
          transition: 'transform 480ms cubic-bezier(.22,1.2,.36,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-10 h-1 rounded-full bg-white/15"></div>
        </div>

        <div className="absolute inset-x-0 top-4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}55, transparent)` }} />

        <div className="px-5 pt-2 pb-6 overflow-y-auto scroll-thin" style={{ maxHeight: 'calc(100% - 20px)' }}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted font-semibold">Predict Sentiment</div>
            <button onClick={onClose} className="text-muted active:text-white w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.04]">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
          </div>
          <h3 className="text-[22px] font-bold text-white tracking-tight mb-1 leading-tight">{subject.name}</h3>
          <div className="font-mono text-[10.5px] text-muted mb-5 flex items-center gap-2 flex-wrap">
            <span>{subject.ticker}</span>
            <span className="opacity-30">·</span>
            <CategoryBadge category={subject.category} />
          </div>

          <div className="rounded-xl bg-ink/60 border border-white/[0.05] p-4 mb-5 flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
              <ArcGauge value={subject.score} color={color} size={72} stroke={5} delay={120} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="tnum text-[18px] font-bold text-white mt-1.5">{subject.score}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted font-semibold mb-1">Current Score</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="tnum text-[20px] font-bold text-white">{subject.score}</span>
                <SignalBadge signal={subject.signal} />
              </div>
              <div className="text-[10.5px] text-muted mt-1">Confidence {subject.confidence}% · {subject.posts.toLocaleString()} posts</div>
            </div>
          </div>

          <p className="text-[13.5px] text-gray-200 leading-snug mb-4">
            Will the sentiment score be <span className="font-semibold">higher</span> or <span className="font-semibold">lower</span> in 24 hours?
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <button
              onClick={() => setChoice('higher')}
              className={`relative rounded-xl border-2 py-4 px-3 transition-all
                ${choice === 'higher' ? 'border-bull bg-bull/15' : 'border-bull/40 active:bg-bull/10'}`}
            >
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-bull mb-1">Higher</div>
              <div className="flex items-center justify-center gap-2 text-2xl font-bold text-bull">
                <span>↑</span><span>{subject.score + 1}+</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">More bullish</div>
            </button>
            <button
              onClick={() => setChoice('lower')}
              className={`relative rounded-xl border-2 py-4 px-3 transition-all
                ${choice === 'lower' ? 'border-bear bg-bear/15' : 'border-bear/40 active:bg-bear/10'}`}
            >
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-bear mb-1">Lower</div>
              <div className="flex items-center justify-center gap-2 text-2xl font-bold text-bear">
                <span>↓</span><span>{subject.score - 1}-</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">More bearish</div>
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.04] px-3 py-3 gap-3 mb-5">
            <div className="text-[11px] text-gray-400 leading-snug">
              Correct earn <span className="text-gold font-semibold">10 AEC</span>. Streak 5+ <span className="text-gold font-semibold">doubles</span>.
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted">Streak</div>
              <div className="text-[15px] font-bold text-orange-300 flex items-center gap-1 justify-end">
                <span>🔥</span><span className="tnum">3</span>
              </div>
            </div>
          </div>

          <button
            disabled={!choice}
            className={`w-full rounded-xl py-3.5 text-[13px] font-semibold tracking-wide transition-all
              ${choice
                ? 'bg-gold text-ink active:bg-goldd shadow-gold-glow'
                : 'bg-white/[0.04] text-gray-500'}`}
          >
            {choice ? `Lock in ${choice.toUpperCase()} · 10 AEC` : 'Select a direction'}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  FadeIn, CountUp, ArcGauge, CategoryBadge, SignalBadge, ConfidenceBar,
  MobileCard, MobileActivityRow, MobileLeaderRow, MobilePredictionModal,
  signalColor, signalBg, signalRing,
});
