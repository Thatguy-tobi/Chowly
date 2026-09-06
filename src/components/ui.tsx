import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Small shared primitives, so every screen looks like the same application. */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition " +
  "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-sm",
  secondary:
    "bg-surface-raised text-ink border border-border-subtle hover:border-border-strong",
  ghost: "text-ink-soft hover:text-ink hover:bg-surface-sunken",
  danger: "bg-danger-soft text-danger border border-transparent hover:border-danger/30",
} as const;

const SIZES = {
  sm: "text-sm px-3.5 py-2",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-6 py-3.5",
} as const;

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={`${BUTTON_BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface-raised shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

const TONES = {
  neutral: "bg-surface-sunken text-ink-soft",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-faint">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-accent"
      />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span aria-hidden className="text-4xl">
        {icon}
      </span>
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {children && <p className="max-w-xs text-sm text-ink-soft">{children}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
    >
      {children}
    </p>
  );
}

/** A labelled field wrapper, so every form on the site is laid out the same. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-ink " +
  "placeholder:text-ink-faint focus:border-accent focus:outline-none";
