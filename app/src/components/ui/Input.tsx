import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className="text-h2 text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-input border border-border bg-surface px-3.5 py-3 text-body text-ink shadow-card outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/30",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = "Input";
