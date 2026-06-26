import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

type Tier = "good" | "warn" | "poor";

function getTier(score: number): Tier {
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "poor";
}

const STROKE: Record<Tier, string> = {
  good: "stroke-good",
  warn: "stroke-warn",
  poor: "stroke-poor",
};
const TEXT: Record<Tier, string> = {
  good: "text-good",
  warn: "text-warn",
  poor: "text-poor",
};

export function ScoreGauge({
  score,
  size = 216,
  strokeWidth = 14,
  className,
}: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;

  const tier = getTier(score);

  useEffect(() => {
    let frame: number;
    const duration = 1000;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90" style={{ overflow: "visible" }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-border-strong"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Glow */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(STROKE[tier], "transition-all duration-1000 ease-out")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: "blur(6px)", opacity: 0.5 }}
        />
        {/* Main arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(STROKE[tier], "transition-all duration-1000 ease-out")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className={cn("font-bold leading-none tabular-nums", TEXT[tier])}
          style={{ fontSize: "56px" }}
        >
          {displayScore}
        </span>
        <span className="mt-1.5 text-label uppercase text-muted">SEO Score</span>
      </div>
    </div>
  );
}
