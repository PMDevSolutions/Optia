import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  const toggleId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={toggleId} className="inline-flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          id={toggleId}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={cn(
            "h-6 w-11 rounded-pill transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40",
            checked ? "bg-brand" : "border border-border-strong bg-surface-3",
          )}
        />
        <div
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-5",
          )}
        />
      </div>
      {label && <span className="text-body text-ink">{label}</span>}
    </label>
  );
}
