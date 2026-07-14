import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export const buttonVariantClasses = (variant: ButtonVariant) => ({
  primary: 'min-h-11 rounded-full bg-white px-4 text-sm text-black transition-colors hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40',
  secondary: 'min-h-11 rounded-full border border-[#2a2c31] px-4 text-sm text-white transition-colors hover:border-neutral-500 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40',
  danger: 'min-h-11 rounded-full border border-red-900 px-4 text-sm text-red-300 transition-colors hover:border-red-500 hover:bg-red-950/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:cursor-not-allowed disabled:opacity-40',
  quiet: 'min-h-11 rounded-full px-3 text-sm text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40'
}[variant]);

export const dataSurfaceClasses = 'overflow-hidden rounded-lg border border-[#2a2c31] bg-[#101114]';

export const statusToneClasses = (tone: StatusTone) => ({
  neutral: 'border-[#2a2c31] text-neutral-300',
  success: 'border-emerald-900 text-emerald-300',
  warning: 'border-amber-900 text-amber-300',
  danger: 'border-red-900 text-red-300'
}[tone]);

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`${buttonVariantClasses(variant)} ${className}`} {...props} />;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b border-[#2a2c31] pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">{eyebrow}</p>}
      <h1 className="mt-2 text-3xl font-normal tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-neutral-400">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </header>;
}

export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-lg border border-[#2a2c31] bg-[#101114] p-4 sm:p-6 ${className}`}>{children}</section>;
}

export function DataSurface({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`${dataSurfaceClasses} ${className}`}>{children}</div>;
}

export function StatusBadge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: StatusTone }>) {
  return <span className={`inline-flex rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusToneClasses(tone)}`}>{children}</span>;
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="border-l border-[#2a2c31] pl-3">
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{label}</p>
    <p className="mt-1 text-xl font-normal tracking-[-0.03em] text-white">{value}</p>
    {detail && <p className="mt-1 text-xs text-neutral-500">{detail}</p>}
  </div>;
}
