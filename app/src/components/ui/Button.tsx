import { cn } from "@/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "small";
  showArrow?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "default",
  showArrow,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" &&
          "bg-brand text-brand-fg shadow-brand hover:bg-brand-hover active:scale-[0.98]",
        variant === "secondary" &&
          "border border-border bg-surface-2 text-ink hover:bg-surface-3 active:scale-[0.98]",
        variant === "ghost" &&
          "bg-transparent text-muted hover:bg-surface-2 hover:text-ink",
        size === "default" && "px-5 py-3 text-button",
        size === "small" && "px-3.5 py-2 text-[13px]",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      {showArrow && !loading && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}
