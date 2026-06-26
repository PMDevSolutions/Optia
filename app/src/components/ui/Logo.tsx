import { cn } from "@/lib/utils";

interface MarkProps {
  size?: number;
  className?: string;
}

/**
 * Optia brand mark — an open score-gauge ring with an upward arrow,
 * evoking "optimize → score rising". Uses the fixed indigo→sky brand
 * gradient in both themes. Mirrors the extension icon art.
 */
export function OptiaMark({ size = 28, className }: MarkProps) {
  const gid = "optia-mark-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      {/* Gauge ring, open at the bottom */}
      <path
        d="M7.76 24.24 A12 12 0 1 1 24.24 24.24"
        stroke={`url(#${gid})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Upward arrow */}
      <path
        d="M16 22 V11.5 M11.6 15.9 L16 11.5 L20.4 15.9"
        stroke={`url(#${gid})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function OptiaWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <OptiaMark size={24} />
      <span className="text-[17px] font-bold tracking-tight text-ink">Optia</span>
    </div>
  );
}
