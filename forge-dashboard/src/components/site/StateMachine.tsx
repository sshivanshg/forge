const W = 118;
const H = 36;
const S: Record<string, { x: number; y: number; tone: string }> = {
  QUEUED: { x: 20, y: 130, tone: "#a1a1aa" },
  BUILDING: { x: 170, y: 130, tone: "#f76b15" },
  DEPLOYING: { x: 320, y: 130, tone: "#f76b15" },
  HEALTH_CHECKING: { x: 470, y: 130, tone: "#f76b15" },
  CANARY: { x: 640, y: 130, tone: "#22d3ee" },
  LIVE: { x: 790, y: 130, tone: "#34d399" },
  SUPERSEDED: { x: 950, y: 90, tone: "#71717a" },
  STOPPED: { x: 950, y: 170, tone: "#71717a" },
  FAILED: { x: 470, y: 250, tone: "#f87171" },
  CANCELLED: { x: 95, y: 30, tone: "#71717a" },
};
const c = (k: string) => ({ x: S[k].x + W / 2, y: S[k].y + H / 2 });

/** Mirrors DeploymentStatus.ALLOWED exactly. */
export function StateMachine() {
  const right = (a: string, b: string, label?: string) => {
    const y = S[a].y + H / 2;
    return { d: `M${S[a].x + W} ${y} L${S[b].x} ${y}`, label, lx: (S[a].x + W + S[b].x) / 2, ly: y - 7 };
  };
  const edges = [
    right("QUEUED", "BUILDING"),
    right("BUILDING", "DEPLOYING"),
    right("DEPLOYING", "HEALTH_CHECKING"),
    right("HEALTH_CHECKING", "CANARY", "canary"),
    right("CANARY", "LIVE"),
    { d: `M${c("HEALTH_CHECKING").x} ${S.HEALTH_CHECKING.y} C ${c("HEALTH_CHECKING").x + 40} 70, ${c("LIVE").x - 40} 70, ${c("LIVE").x} ${S.LIVE.y}`, label: "blue-green", lx: 715, ly: 82 },
    { d: `M${c("QUEUED").x} ${S.QUEUED.y + H} C ${c("QUEUED").x + 20} 215, ${c("DEPLOYING").x - 20} 215, ${c("DEPLOYING").x} ${S.DEPLOYING.y + H}`, label: "rollback / recovery", lx: 245, ly: 222 },
    { d: `M${S.LIVE.x + W} ${c("LIVE").y - 6} L${S.SUPERSEDED.x} ${c("SUPERSEDED").y}` },
    { d: `M${S.LIVE.x + W} ${c("LIVE").y + 6} L${S.STOPPED.x} ${c("STOPPED").y}` },
    { d: `M${c("QUEUED").x - 10} ${S.QUEUED.y} L${S.CANCELLED.x + 20} ${S.CANCELLED.y + H}` },
    { d: `M${c("BUILDING").x} ${S.BUILDING.y} L${S.CANCELLED.x + W - 20} ${S.CANCELLED.y + H}` },
    ...["BUILDING", "DEPLOYING", "HEALTH_CHECKING", "CANARY"].map((k) => ({
      d: `M${c(k).x} ${S[k].y + H} L${c("FAILED").x + (c(k).x - c("FAILED").x) * 0.25} ${S.FAILED.y}`,
    })),
  ];
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-white/[0.08] bg-ink-900/60">
      <svg viewBox="0 0 1090 310" className="min-w-[760px]" role="img" aria-labelledby="sm-title sm-desc">
        <title id="sm-title">Deployment state machine</title>
        <desc id="sm-desc">
          QUEUED to BUILDING, DEPLOYING, HEALTH_CHECKING, optionally CANARY, then LIVE, then SUPERSEDED or STOPPED. BUILDING, DEPLOYING,
          HEALTH_CHECKING and CANARY can go to FAILED. QUEUED and BUILDING can be CANCELLED. A rollback or recovery goes from QUEUED
          straight to DEPLOYING.
        </desc>
        <defs>
          <marker id="sm-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 8 4 0 8z" fill="#71717a" />
          </marker>
        </defs>
        {edges.map((e, i) => (
          <g key={i}>
            <path d={e.d} fill="none" stroke="rgb(161 161 170 / 0.45)" strokeWidth="1.2" markerEnd="url(#sm-a)" />
            {"label" in e && e.label && (
              <text x={e.lx} y={e.ly} textAnchor="middle" fontSize="10" className="fill-zinc-400 font-mono">
                {e.label}
              </text>
            )}
          </g>
        ))}
        {Object.entries(S).map(([k, s]) => (
          <g key={k}>
            <rect x={s.x} y={s.y} width={W} height={H} rx="18" fill="#141416" stroke={s.tone} strokeOpacity="0.8" />
            <text x={s.x + W / 2} y={s.y + 22} textAnchor="middle" fontSize="11" fontWeight="600" fill={s.tone} className="font-mono">
              {k}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
