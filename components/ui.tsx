// shadcn/ui-style primitives (Tailwind). Server-safe: no hooks.
import * as React from 'react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Level } from '@/lib/types';

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

const btn = {
  base: 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50',
  variant: {
    default: 'bg-primary text-white hover:bg-primary-700 shadow-sm',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  },
  size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-6 text-base', icon: 'h-9 w-9' },
};
export type ButtonVariant = keyof typeof btn.variant;
export function buttonClass(variant: ButtonVariant = 'default', size: keyof typeof btn.size = 'default', className?: string) {
  return cn(btn.base, btn.variant[variant], btn.size[size], className);
}
export function Button({ variant = 'default', size = 'default', className, ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof btn.size }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}
export function LinkButton({ href, variant = 'outline', size = 'sm', className, children }:
  { href: string; variant?: ButtonVariant; size?: keyof typeof btn.size; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={buttonClass(variant, size, className)}>{children}</Link>;
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...p} />;
}
export function CardHeader({ className, title, description, action }:
  { className?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5', className)}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...p} />;
}

const field = 'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-slate-500';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, className)} {...p} />);
Input.displayName = 'Input';
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, 'pr-8', className)} {...p} />;
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, 'h-auto min-h-[72px]', className)} {...p} />;
}
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1 block text-xs font-medium text-slate-600', className)} {...p} />;
}
export function Field({ label, children, className, hint }: { label: React.ReactNode; children: React.ReactNode; className?: string; hint?: React.ReactNode }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
export function Checkbox({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" {...p} />
      {label}
    </label>
  );
}

export function Badge({ className, tone = 'slate', ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'slate' | 'blue' | 'green' | 'yellow' | 'red' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)} {...p} />;
}

export const levelTone: Record<Level, 'green' | 'yellow' | 'red'> = { green: 'green', yellow: 'yellow', red: 'red' };
export const levelBg: Record<Level, string> = {
  green: 'bg-emerald-50 text-emerald-800',
  yellow: 'bg-amber-50 text-amber-900',
  red: 'bg-red-50 text-red-800',
};
export const levelDot: Record<Level, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-red-500' };

export function LevelBadge({ level, label }: { level: Level; label: string }) {
  return (
    <Badge tone={levelTone[level]}>
      <span className={cn('h-1.5 w-1.5 rounded-full', levelDot[level])} />
      {label}
    </Badge>
  );
}
export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = ({ draft: 'slate', submitted: 'blue', approved: 'green', rejected: 'red', active: 'green', inactive: 'slate', pending: 'yellow' } as const)[status as 'draft'] ?? 'slate';
  return <Badge tone={tone}>{label}</Badge>;
}

export function StatCard({ label, value, sub, tone, icon }:
  { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Level | 'blue'; icon?: React.ReactNode }) {
  const ring = tone === 'red' ? 'border-l-red-500' : tone === 'yellow' ? 'border-l-amber-400' : tone === 'green' ? 'border-l-emerald-500' : 'border-l-primary';
  return (
    <Card className={cn('border-l-4 p-4', ring)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-full text-left text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) =>
  <th className={cn('whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', className)} {...p} />;
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) =>
  <td className={cn('border-b border-slate-100 px-3 py-2 align-middle text-slate-700', className)} {...p} />;
