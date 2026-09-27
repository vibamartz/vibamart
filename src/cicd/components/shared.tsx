// ViBa CI/CD Platform — Shared UI Components

import React from 'react';
import type { PipelineStatus, DeploymentStatus } from '../types';

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: PipelineStatus | DeploymentStatus | string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  queued:           { label: 'Queued',      bg: 'bg-slate-500/15', text: 'text-slate-300',  dot: 'bg-slate-400' },
  running:          { label: 'Running',     bg: 'bg-blue-500/15',  text: 'text-blue-300',   dot: 'bg-blue-400' },
  passed:           { label: 'Passed',      bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  healthy:          { label: 'Healthy',     bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  failed:           { label: 'Failed',      bg: 'bg-red-500/15',   text: 'text-red-300',    dot: 'bg-red-400' },
  cancelled:        { label: 'Cancelled',   bg: 'bg-slate-500/15', text: 'text-slate-400',  dot: 'bg-slate-500' },
  skipped:          { label: 'Skipped',     bg: 'bg-slate-500/15', text: 'text-slate-400',  dot: 'bg-slate-500' },
  pending_approval: { label: 'Pending',     bg: 'bg-amber-500/15', text: 'text-amber-300',  dot: 'bg-amber-400' },
  pending:          { label: 'Pending',     bg: 'bg-amber-500/15', text: 'text-amber-300',  dot: 'bg-amber-400' },
  degraded:         { label: 'Degraded',    bg: 'bg-orange-500/15', text: 'text-orange-300', dot: 'bg-orange-400' },
  rolled_back:      { label: 'Rolled Back', bg: 'bg-purple-500/15', text: 'text-purple-300', dot: 'bg-purple-400' },
  unknown:          { label: 'Unknown',     bg: 'bg-slate-500/15', text: 'text-slate-400',  dot: 'bg-slate-500' },
};

export function StatusBadge({ status, size = 'md', pulse = false }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['unknown'];
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };
  const dotSizes = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${cfg.bg} ${cfg.text} ${sizeClasses[size]}`}
    >
      <span
        className={`inline-block rounded-full ${cfg.dot} ${dotSizes[size]} ${
          pulse && (status === 'running' || status === 'pending') ? 'animate-pulse' : ''
        }`}
      />
      {cfg.label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'green' | 'blue' | 'red' | 'amber' | 'purple' | 'slate';
  loading?: boolean;
  onClick?: () => void;
}

const CARD_COLORS = {
  green:  { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  blue:   { icon: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  red:    { icon: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  amber:  { icon: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  purple: { icon: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
  slate:  { icon: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20' },
};

export function StatCard({ label, value, icon, trend, color = 'slate', loading, onClick }: StatCardProps) {
  const c = CARD_COLORS[color];
  return (
    <div
      className={`relative rounded-xl border bg-[#1a1d27] p-5 transition-all duration-200 ${c.border} ${
        onClick ? 'cursor-pointer hover:bg-[#1e2130] hover:shadow-lg hover:shadow-black/20' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-slate-700/50" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
          )}
          {trend && !loading && (
            <p className={`mt-1 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ${c.bg}`}>
          <div className={`h-5 w-5 ${c.icon}`}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>;
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {breadcrumbs && (
          <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                <button
                  onClick={b.onClick}
                  className={`${b.onClick ? 'hover:text-slate-300 cursor-pointer' : 'text-slate-400'} transition-colors`}
                >
                  {b.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold text-white sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-700/40 text-slate-400">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

export function Skeleton({ className = '', key }: { className?: string; key?: React.Key }) {
  return <div key={key} className={`animate-pulse rounded-lg bg-slate-700/50 ${className}`} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-lg bg-[#1a1d27] px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: (e?: any) => void | Promise<void>;
  type?: 'button' | 'submit' | 'reset';
  key?: React.Key;
}

const BTN_VARIANTS = {
  primary:   'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-500 border-transparent',
  secondary: 'bg-slate-700 text-slate-200 hover:bg-slate-600 focus-visible:ring-slate-500 border-transparent',
  danger:    'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500 border-transparent',
  ghost:     'bg-transparent text-slate-300 hover:bg-slate-700/60 focus-visible:ring-slate-500 border-transparent',
  outline:   'bg-transparent text-slate-300 hover:bg-slate-700/40 focus-visible:ring-slate-500 border-slate-600',
};

const BTN_SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  disabled,
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      onClick={onClick as any}
      className={`
        inline-flex items-center justify-center rounded-lg border font-semibold
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1117]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}
      `}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : icon ? (
        <span className="h-4 w-4">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  className?: string;
  value?: any;
  defaultValue?: any;
  type?: string;
  onChange?: (e: any) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  name?: string;
  id?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  checked?: boolean;
  multiple?: boolean;
  key?: React.Key;
}

export function Input({ label, error, hint, leftIcon, rightElement, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          {...props}
          className={`
            w-full rounded-lg border bg-[#0f1117] px-3 py-2.5 text-sm text-white
            placeholder:text-slate-500
            border-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${leftIcon ? 'pl-9' : ''}
            ${rightElement ? 'pr-10' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
        />
        {rightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {rightElement}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
  value?: any;
  defaultValue?: any;
  onChange?: (e: any) => void;
  disabled?: boolean;
  multiple?: boolean;
  name?: string;
  id?: string;
  key?: React.Key;
}

export function Select({ label, error, options, className = '', id, ...props }: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        className={`
          w-full rounded-lg border bg-[#0f1117] px-3 py-2.5 text-sm text-white
          border-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  color?: 'green' | 'blue' | 'red' | 'amber' | 'purple' | 'slate' | 'indigo';
  size?: 'sm' | 'md';
  className?: string;
}

const BADGE_COLORS = {
  green:  'bg-emerald-500/15 text-emerald-300',
  blue:   'bg-blue-500/15 text-blue-300',
  red:    'bg-red-500/15 text-red-300',
  amber:  'bg-amber-500/15 text-amber-300',
  purple: 'bg-purple-500/15 text-purple-300',
  slate:  'bg-slate-500/15 text-slate-300',
  indigo: 'bg-indigo-500/15 text-indigo-300',
};

export function Badge({ children, color = 'slate', size = 'md', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${BADGE_COLORS[color]} ${
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      } ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

const MODAL_SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={`relative w-full ${MODAL_SIZES[size]} rounded-2xl border border-slate-700/60 bg-[#1a1d27] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700/60 px-6 py-4">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-700/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <p className="text-slate-400">
        Showing <span className="text-slate-200 font-medium">{from}–{to}</span> of{' '}
        <span className="text-slate-200 font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                p === page
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg px-3 py-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
}

// ─── Duration formatter ───────────────────────────────────────────────────────

export function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

// ─── Relative time ────────────────────────────────────────────────────────────

export function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Commit SHA display ───────────────────────────────────────────────────────

export function ShortSha({ sha }: { sha?: string }) {
  if (!sha) return <span className="text-slate-500">—</span>;
  return (
    <code className="rounded bg-slate-700/60 px-1.5 py-0.5 text-xs font-mono text-slate-300">
      {sha.slice(0, 8)}
    </code>
  );
}

// ─── Log Viewer ───────────────────────────────────────────────────────────────

interface LogViewerProps {
  logs?: string;
  loading?: boolean;
  maxHeight?: string;
}

export function LogViewer({ logs, loading, maxHeight = '400px' }: LogViewerProps) {
  const logLines = (logs || '').split('\n');
  return (
    <div
      className="overflow-auto rounded-xl border border-slate-700/60 bg-[#0a0c10] font-mono text-xs"
      style={{ maxHeight }}
    >
      {loading ? (
        <div className="flex items-center gap-2 p-4 text-slate-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading logs…
        </div>
      ) : !logs ? (
        <div className="p-4 text-slate-500">No logs available.</div>
      ) : (
        <table className="w-full">
          <tbody>
            {logLines.map((line, i) => (
              <tr key={i} className="group hover:bg-slate-700/20">
                <td className="select-none w-12 px-3 py-0.5 text-slate-600 text-right border-r border-slate-700/30">
                  {i + 1}
                </td>
                <td
                  className={`px-4 py-0.5 ${
                    line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')
                      ? 'text-red-400'
                      : line.toLowerCase().includes('warn')
                      ? 'text-amber-400'
                      : line.toLowerCase().includes('success') || line.toLowerCase().includes('passed')
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  } whitespace-pre-wrap break-all`}
                >
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', variant = 'danger', loading,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-400">{description}</p>
    </Modal>
  );
}

// ─── Search Input ─────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-[#0f1117] py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
      />
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

interface TabBarProps {
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex gap-1 border-b border-slate-700/60">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700/60 text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Data Table ───────────────────────────────────────────────────────────────

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  keyExtractor: (row: T) => string;
}

export function DataTable<T>({
  columns, data, loading, onRowClick, emptyState, keyExtractor,
}: DataTableProps<T>) {
  if (loading) return <TableSkeleton />;
  if (!data.length) return emptyState ? <>{emptyState}</> : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              className={`border-b border-slate-700/30 transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-slate-700/20' : ''
              }`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-300">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
