import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--hoi-color-orange),var(--hoi-color-orange-bright))] text-white shadow-[var(--hoi-shadow-glow)] hover:-translate-y-0.5 hover:brightness-110",
  secondary:
    "border border-[var(--hoi-border)] bg-[var(--hoi-surface)] text-[var(--hoi-text)] backdrop-blur-xl hover:border-[color:var(--hoi-color-orange)]",
  ghost:
    "bg-transparent text-[var(--hoi-text)] hover:bg-white/5 hover:text-[var(--hoi-color-orange)]"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-7 text-base"
};

export function Button({
  children,
  className,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--hoi-radius-lg)] font-semibold transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hoi-color-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hoi-background)] disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
