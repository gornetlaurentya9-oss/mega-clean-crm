import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { CloseIcon } from "./Icons";

export function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonVariants = {
  primary: "bg-brand-primary text-white hover:bg-brand-accent active:bg-brand-secondary shadow-sm hover:shadow-soft",
  secondary: "bg-white text-brand-primary border border-brand-secondary/40 hover:bg-brand-accent/10 hover:border-brand-accent",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost: "bg-transparent text-brand-primary hover:bg-brand-accent/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
        size === "md" ? "min-h-[44px] px-4 py-2 text-base" : "min-h-[36px] px-3 py-1.5 text-sm",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

interface FieldWrapProps {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}

export function FieldWrap({ label, error, hint, children, required }: FieldWrapProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputBase =
  "block w-full min-h-[44px] rounded-control border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-400 transition-all duration-150 ease-out focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/40 disabled:bg-gray-100";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, required, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint} required={required}>
      <input ref={ref} className={cx(inputBase, error && "border-red-400", className)} {...props} />
    </FieldWrap>
  )
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, required, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint} required={required}>
      <textarea ref={ref} className={cx(inputBase, "min-h-[88px]", error && "border-red-400", className)} {...props} />
    </FieldWrap>
  )
);
Textarea.displayName = "Textarea";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className, required, children, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint} required={required}>
      <select ref={ref} className={cx(inputBase, "pr-8", error && "border-red-400", className)} {...props}>
        {children}
      </select>
    </FieldWrap>
  )
);
Select.displayName = "Select";

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-base text-gray-800">
      <input
        type="checkbox"
        className="h-5 w-5 rounded border-gray-300 text-brand-primary transition-colors focus:ring-2 focus:ring-brand-accent/40"
        {...props}
      />
      {label}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-panel border border-gray-200 bg-white p-4 shadow-soft", className)}>{children}</div>;
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "yellow" | "red" | "blue" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/50 backdrop-blur-[1px] sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full animate-fade-slide-in overflow-y-auto rounded-t-panel bg-white p-4 shadow-soft-lg sm:max-w-lg sm:rounded-panel sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-panel border border-gray-200 bg-white shadow-soft", className)}>
      <table className="w-full min-w-[560px] text-left text-sm">{children}</table>
    </div>
  );
}

/** Optional helper for an interactive/clickable table row with brand hover + active states. */
export function TableRow({
  children,
  className,
  active,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { active?: boolean }) {
  return (
    <tr
      className={cx(
        "cursor-pointer border-t border-gray-100 transition-colors duration-150",
        active ? "bg-brand-accent/10" : "hover:bg-brand-accent/5",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-panel border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">{children}</div>;
}

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = size === "sm" ? "h-5 w-5 border-2" : size === "lg" ? "h-12 w-12 border-4" : "h-8 w-8 border-4";
  return (
    <div className="flex justify-center p-8">
      <div className={cx("animate-spin rounded-full border-brand-accent/25 border-t-brand-primary", px)} />
    </div>
  );
}

/** Branded skeleton block for loading placeholders (text lines, tiles, avatars, etc). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-control bg-gradient-to-r from-brand-accent/10 via-brand-accent/20 to-brand-accent/10 bg-[length:200%_100%]",
        className
      )}
    />
  );
}

/** A small stack of skeleton rows, e.g. for a card list or table body while data loads. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-panel border border-gray-100 bg-white p-4 shadow-soft">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
