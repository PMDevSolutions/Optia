export function LoadingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 p-6">
      {/* Animated score-ring placeholder */}
      <div className="relative inline-flex items-center justify-center">
        <svg width={140} height={140} className="-rotate-90" aria-hidden="true">
          <circle cx={70} cy={70} r={62} fill="none" className="stroke-surface-3" strokeWidth={12} />
          <circle
            cx={70}
            cy={70}
            r={62}
            fill="none"
            className="origin-center animate-spin stroke-brand [animation-duration:1.1s]"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={389}
            strokeDashoffset={290}
          />
        </svg>
        <span className="absolute text-label uppercase text-muted">Scoring</span>
      </div>

      <div className="text-center">
        <h2 className="text-h1 text-ink">Analyzing your page</h2>
        <p className="mt-2 text-body text-muted">
          Extracting SEO data and running checks…
        </p>
      </div>

      {/* Skeleton category cards */}
      <div className="flex w-full max-w-sm flex-col gap-3">
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-16 w-full" />
      </div>
    </div>
  );
}
