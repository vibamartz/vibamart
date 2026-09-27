// ViBa CI/CD Platform — Portal Layout (Sidebar + Topbar)

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCiCdStore } from '../store/cicdStore';

// ─── Navigation Items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    path: '/cicd',             icon: DashboardIcon },
    ],
  },
  {
    group: 'Development',
    items: [
      { id: 'services',     label: 'Services',     path: '/cicd/services',    icon: ServicesIcon },
      { id: 'repositories', label: 'Repositories', path: '/cicd/repositories',icon: RepoIcon },
      { id: 'pipelines',    label: 'Pipelines',    path: '/cicd/pipelines',   icon: PipelinesIcon },
      { id: 'builds',       label: 'Builds',       path: '/cicd/builds',      icon: BuildsIcon },
      { id: 'artifacts',    label: 'Artifacts',    path: '/cicd/artifacts',   icon: ArtifactsIcon },
    ],
  },
  {
    group: 'Delivery',
    items: [
      { id: 'deployments',  label: 'Deployments',  path: '/cicd/deployments', icon: DeploymentsIcon },
      { id: 'environments', label: 'Environments', path: '/cicd/environments',icon: EnvironmentsIcon },
      { id: 'clusters',     label: 'Clusters',     path: '/cicd/clusters',    icon: ClustersIcon },
    ],
  },
  {
    group: 'Security',
    items: [
      { id: 'secrets',      label: 'Secrets',      path: '/cicd/secrets',     icon: SecretsIcon },
      { id: 'security',     label: 'Security',     path: '/cicd/security',    icon: SecurityIcon },
    ],
  },
  {
    group: 'Observability',
    items: [
      { id: 'logs',         label: 'Logs',         path: '/cicd/logs',        icon: LogsIcon },
      { id: 'monitoring',   label: 'Monitoring',   path: '/cicd/monitoring',  icon: MonitoringIcon },
      { id: 'audit',        label: 'Audit Logs',   path: '/cicd/audit',       icon: AuditIcon },
    ],
  },
  {
    group: 'Administration',
    items: [
      { id: 'settings',     label: 'Settings',     path: '/cicd/settings',    icon: SettingsIcon },
    ],
  },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function ServicesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
      <path d="M6 6h.01M6 18h.01" />
    </svg>
  );
}
function RepoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
function PipelinesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <circle cx="12" cy="12" r="3" />
      <path d="M3 12h6M15 12h6M12 3v6M12 15v6" />
    </svg>
  );
}
function BuildsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <path d="M2 20h20M4 20V10l8-6 8 6v10" /><path d="M12 20v-5" />
    </svg>
  );
}
function ArtifactsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function DeploymentsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}
function EnvironmentsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}
function ClustersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
      <path d="M12 8v8M12 16l-4.5 2M12 16l4.5 2" />
    </svg>
  );
}
function SecretsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function SecurityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function LogsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function MonitoringIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function AuditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function CiCdSidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/cicd') return location.pathname === '/cicd';
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`flex flex-col border-r border-slate-700/60 bg-[#12151f] transition-all duration-300 overflow-hidden ${
        collapsed ? 'w-16' : 'w-60'
      }`}
      style={{ minHeight: '100vh' }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-slate-700/60 px-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="h-4 w-4">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-none">ViBa Platform</p>
            <p className="text-[10px] text-indigo-400 font-medium tracking-wider mt-0.5">CI/CD</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_ITEMS.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {group.group}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    title={collapsed ? item.label : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'bg-indigo-600/20 text-indigo-300'
                        : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <span className={`h-4 w-4 flex-shrink-0 ${active ? 'text-indigo-400' : ''}`}>
                      <Icon />
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-700/60 p-2">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-500 hover:bg-slate-700/40 hover:text-slate-300 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

interface TopbarProps {
  title?: string;
}

export function CiCdTopbar({ title }: TopbarProps) {
  const navigate = useNavigate();
  const { stats } = useCiCdStore();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-700/60 bg-[#12151f] px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {stats && stats.runningBuilds > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            {stats.runningBuilds} running
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Queue depth indicator */}
        {stats && stats.queueDepth > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            {stats.queueDepth} queued
          </div>
        )}

        {/* Back to ViBa Mart */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700/40 hover:text-slate-200 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Back to ViBa Mart
        </button>
      </div>
    </header>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

interface CiCdLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function CiCdLayout({ children, title }: CiCdLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0f1117] font-sans" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <CiCdSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CiCdTopbar title={title} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
