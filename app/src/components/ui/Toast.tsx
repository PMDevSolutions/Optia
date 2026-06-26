import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, visible, onClose, duration = 3000 }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible && !show) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2.5 shadow-pop transition-all duration-300",
        show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <Check className="h-4 w-4 text-good" />
      <span className="text-body-12 text-ink">{message}</span>
      <button onClick={onClose} aria-label="Dismiss" className="text-muted hover:text-ink">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
