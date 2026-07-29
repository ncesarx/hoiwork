import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <article
      className={cn(
        "rounded-[var(--hoi-radius-xl)] border border-[var(--hoi-border)] bg-[var(--hoi-surface)] p-6 shadow-[var(--hoi-shadow-md)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-orange-400/50 hover:shadow-[var(--hoi-shadow-glow)]",
        className
      )}
      {...props}
    >
      {children}
    </article>
  );
}
