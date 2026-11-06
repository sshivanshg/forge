const STAGES = [
  { x: 70, label: "git push", sub: "HMAC-verified webhook", delay: "0s" },
  { x: 250, label: "build", sub: "detect → container build", delay: "1.2s" },
  { x: 430, label: "canary", sub: "20% → 50% → 100%", delay: "2.4s", cyan: true },
  { x: 610, label: "live", sub: "slug.localhost", delay: "3.6s" },
];

const PATH = "M70 110 L610 110";

/** Pure SVG/CSS illustration of the deploy pipeline. Decorative: the text beside it says the same. */
export function PipelineHero() {
  return (
    <figure className="relative" aria-label="Deploy pipeline: git push, build, canary, live">
      <svg viewBox="0 0 680 230" className="w-full" role="img" aria-hidden>
        <defs>
          <linearGradient id="ph-line" x1="0" x2="1">
            <stop offset="0" stopColor="#f76b15" stopOpacity="0.2" />
            <stop offset="0.6" stopColor="#f76b15" stopOpacity="0.8" />
            <stop offset="1" stopColor="#34d399" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="ph-glow">
            <stop offset="0" stopColor="#f76b15" stopOpacity="0.5" />
            <stop offset="1" stopColor="#f76b15" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={PATH} stroke="rgb(255 255 255 / 0.08)" strokeWidth="2" fill="none" />
        <path d={PATH} stroke="url(#ph-line)" strokeWidth="2" fill="none" className="site-flow" />
        {/* rollback branch from canary back to live version */}
        <path d="M430 135 C 430 195, 610 195, 610 135" stroke="rgb(34 211 238 / 0.35)" strokeWidth="1.5" fill="none" strokeDasharray="3 5" />
        <text x="520" y="208" textAnchor="middle" className="fill-cyan-300/70 font-mono" fontSize="10">
          regression → traffic back to live
        </text>
        {STAGES.map((s) => (
          <g key={s.label} className="site-stage" style={{ animationDelay: s.delay }}>
            <circle cx={s.x} cy="110" r="34" fill="url(#ph-glow)" />
            <circle cx={s.x} cy="110" r="20" fill="#161618" stroke={s.cyan ? "#22d3ee" : s.label === "live" ? "#34d399" : "#f76b15"} strokeWidth="1.5" />
            <circle cx={s.x} cy="110" r="5" fill={s.cyan ? "#22d3ee" : s.label === "live" ? "#34d399" : "#f76b15"} />
            <text x={s.x} y="62" textAnchor="middle" className="fill-zinc-100 font-mono" fontSize="13" fontWeight="600">
              {s.label}
            </text>
            <text x={s.x} y="78" textAnchor="middle" className="fill-zinc-500 font-mono" fontSize="9.5">
              {s.sub}
            </text>
          </g>
        ))}
        <circle r="4" fill="#ffd0a8" className="site-packet" style={{ offsetPath: `path("${PATH}")` }} />
      </svg>
      <div className="mx-auto mt-1 max-w-[70%] rounded-md border border-white/[0.06] bg-ink-900/70 p-3">
        <div className="flex justify-between font-mono text-[10px] text-zinc-500">
          <span>traffic · new version</span>
          <span className="text-cyan-300">canary</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="site-canary h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300" />
        </div>
      </div>
    </figure>
  );
}
