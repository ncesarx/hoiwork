import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export const cn = (...v: Array<string | false | null | undefined>) =>
  v.filter(Boolean).join(" ");

const buttonBase =
  "inline-flex items-center justify-center rounded-xl font-extrabold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:opacity-50";

const buttonVariant = {
  primary:
    "bg-[linear-gradient(135deg,var(--gold-light),var(--gold-dark))] text-[#07131d] shadow-[0_14px_42px_rgba(212,160,23,.22)] hover:-translate-y-0.5",
  secondary:
    "border border-white/20 bg-white/[0.04] text-white backdrop-blur-xl hover:border-[var(--gold)]/60",
};

export function ButtonLink({
  className,
  variant = "primary",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: keyof typeof buttonVariant;
  children: ReactNode;
}) {
  return (
    <a
      className={cn(buttonBase, buttonVariant[variant], "min-h-12 px-6 text-sm", className)}
      {...props}
    >
      {children}
    </a>
  );
}

export function Button({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={cn(buttonBase, buttonVariant.primary, "min-h-12 px-6 text-sm", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(23,59,74,.5),rgba(7,24,36,.78))] p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-[var(--gold)]/45",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-12 w-full rounded-xl border border-white/12 bg-[#071925]/72 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--gold)]/70",
        className,
      )}
      {...props}
    />
  );
}
