const STAGES = [
  { x: 70, label: "git push", sub: "HMAC-verified webhook", delay: "0s" },
  { x: 250, label: "build", sub: "detect → container build", delay: "1.2s" },
  { x: 430, label: "canary", sub: "20% → 50% → 100%", delay: "2.4s" },
  { x: 610, label: "live", sub: "slug.localhost", delay: "3.6s", live: true },
];

const PATH = "M70 110 L610 110";

/** Pure SVG/CSS illustration of the deploy pipeline. Decorative: the text beside it says the same. */
export function PipelineHero() {
  return (
    <figure className="relative" aria-label="Deploy pipeline: git push, build, canary, live">
      <svg viewBox="0 0 680 230" className="w-full" role="img" aria-hidden>
        <path d={PATH} stroke="var(--ds-gray-alpha-400)" strokeWidth="1.5" fill="none" />
        <path d={PATH} stroke="var(--ds-blue-700)" strokeWidth="1.5" fill="none" className="site-flow" />
        {/* rollback branch from canary back to live version */}
        <path d="M430 132 C 430 195, 610 195, 610 132" stroke="var(--ds-gray-alpha-600)" strokeWidth="1" fill="none" strokeDasharray="3 5" />
        <text x="520" y="208" textAnchor="middle" fill="var(--ds-gray-900)" className="font-mono" fontSize="10">
          regression → traffic back to live
        </text>
        {STAGES.map((s) => (
          <g key={s.label} className="site-stage" style={{ animationDelay: s.delay }}>
            <rect
              x={s.x - 20}
              y="90"
              width="40"
              height="40"
              rx="8"
              fill="var(--ds-background-100)"
              stroke={s.live ? "var(--ds-green-700)" : "var(--ds-gray-alpha-600)"}
              strokeWidth="1"
            />
            <circle cx={s.x} cy="110" r="4" fill={s.live ? "var(--ds-green-700)" : "var(--ds-gray-1000)"} />
            <text x={s.x} y="62" textAnchor="middle" fill="var(--ds-gray-1000)" className="font-mono" fontSize="13" fontWeight="600">
              {s.label}
            </text>
            <text x={s.x} y="78" textAnchor="middle" fill="var(--ds-gray-900)" className="font-mono" fontSize="9.5">
              {s.sub}
            </text>
          </g>
        ))}
        <circle r="4" fill="var(--ds-blue-700)" className="site-packet" style={{ offsetPath: `path("${PATH}")` }} />
      </svg>
      <div className="mx-auto mt-1 max-w-[70%] rounded-md border border-gray-alpha-400 bg-background-100 p-3">
        <div className="flex justify-between font-mono text-label-12 text-gray-900">
          <span>traffic · new version</span>
          <span className="text-blue-900">canary</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-alpha-200">
          <div className="site-canary h-full rounded-full bg-blue-700" />
        </div>
      </div>
    </figure>
  );
}
