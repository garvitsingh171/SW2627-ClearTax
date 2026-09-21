import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({
  className = "",
  ...props
}: InputProps) {
  return (
    <input
      className={`
        h-10
        w-full
        rounded-lg
        border
        border-border
        bg-surface
        px-3
        text-sm
        text-foreground
        placeholder:text-slate-400
        outline-none
        transition-colors
        focus:border-primary
        focus:ring-2
        focus:ring-primary/20
        disabled:cursor-not-allowed
        disabled:bg-surface-muted
        disabled:opacity-60
        ${className}
      `}
      {...props}
    />
  );
}
