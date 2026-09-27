// ViBa CI/CD Platform — Deployments Page

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CiCdLayout } from '../components/CiCdLayout';
import {
  PageHeader, Button, SearchInput, StatusBadge, DataTable, Pagination,
  EmptyState, Badge, Modal, Select, formatDuration, relativeTime, ShortSha,
  StatCard, ConfirmDialog,
} from '../components/shared';
import { useCiCdStore } from '../store/cicdStore';
import { deploymentsApi, environmentsApi } from '../api/cicdApi';
import type { Deployment } from '../types';

// ─── Deployment Card (for visual grid view) ───────────────────────────────────

function DeploymentCard({ dep, onRollback }: { dep: Deployment; onRollback: (dep: Deployment) => void; key?: React.Key }) {
  const navigate = useNavigate();
  const envBgMap: Record<string, string> = {
    production: 'border-red-500/30 bg-red-500/5',
    staging:    'border-amber-500/30 bg-amber-500/5',
    development:'border-blue-500/30 bg-blue-500/5',
    preview:    'border-purple-500/30 bg-purple-500/5',
  };
  const envName = dep.environmentName?.toLowerCase() ?? '';
  const envBorder = envBgMap[envName] ?? 'border-slate-700/40 bg-[#1a1d27]';

  return (
    <div
      className={`rounded-xl border p-4 cursor-pointer hover:shadow-lg hover:shadow-black/20 transition-all ${envBorder}`}
      onClick={() => navigate(`/cicd/deployments/${dep.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-bold text-white truncate">{dep.serviceName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              envName === 'production' ? 'bg-red-500/20 text-red-300' :
              envName === 'staging'    ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-blue-500/20 text-blue-300'
            }`}>
              {dep.environmentName}
            </span>
            <ShortSha sha={dep.version} />
          </div>
        </div>
        <StatusBadge status={dep.status} size="sm" pulse={dep.status === 'running'} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <p className="text-slate-500">Strategy</p>
          <Badge color="indigo" size="sm">{dep.strategy.type}</Badge>
        </div>
        <div>
          <p className="text-slate-500">Namespace</p>
          <code className="text-slate-300">{dep.namespace}</code>
        </div>
        <div>
          <p className="text-slate-500">Duration</p>
          <p className="text-slate-300 font-mono">{formatDuration(dep.durationMs)}</p>
        </div>
        <div>
          <p className="text-slate-500">Deployed</p>
          <p className="text-slate-300">{relativeTime(dep.finishedAt || dep.startedAt)}</p>
        </div>
      </div>

      {/* Health indicator */}
      {dep.health && (
        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
          dep.health.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-300' :
          dep.health.status === 'degraded' ? 'bg-amber-500/10 text-amber-300' :
          'bg-red-500/10 text-red-300'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${
            dep.health.status === 'healthy' ? 'bg-emerald-400 animate-pulse' :
            dep.health.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400'
          }`} />
          Health: {dep.health.status}
        </div>
      )}

      {/* Rollback action */}
      {dep.rollbackAvailable && (dep.status === 'failed' || dep.status === 'degraded') && (
        <button
          onClick={(e) => { e.stopPropagation(); onRollback(dep); }}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Rollback to {dep.previousVersion?.slice(0, 8) ?? 'previous'}
        </button>
      )}
    </div>
  );
}

// ─── Deployments Page ─────────────────────────────────────────────────────────

export default function DeploymentsPage() {
  const navigate = useNavigate();
  const { deployments, deploymentsTotal, setDeployments, upsertDeployment, environments, setEnvironments } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const PAGE_SIZE = 24;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depsRes, envsRes] = await Promise.allSettled([
        deploymentsApi.list({
          page, pageSize: PAGE_SIZE,
          environmentId: envFilter || undefined,
          status: (statusFilter as any) || undefined,
        }),
        environmentsApi.list(),
      ]);
      if (depsRes.status === 'fulfilled') setDeployments(depsRes.value.data, depsRes.value.pagination.total);
      if (envsRes.status === 'fulfilled') setEnvironments(envsRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [page, envFilter, statusFilter, setDeployments, setEnvironments]);

  useEffect(() => { load(); }, [load]);

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setRollingBack(true);
    try {
      const res = await deploymentsApi.rollback(rollbackTarget.id, undefined, 'Manual rollback from dashboard');
      upsertDeployment(res.data);
      setRollbackTarget(null);
    } finally {
      setRollingBack(false);
    }
  };

  const envOptions = [
    { value: '', label: 'All Environments' },
    ...environments.map((e) => ({ value: e.id, label: e.name })),
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'running', label: 'Running' },
    { value: 'failed', label: 'Failed' },
    { value: 'degraded', label: 'Degraded' },
    { value: 'rolled_back', label: 'Rolled Back' },
  ];

  const filteredDeployments = search
    ? deployments.filter((d) =>
        d.serviceName.toLowerCase().includes(search.toLowerCase()) ||
        d.version.toLowerCase().includes(search.toLowerCase())
      )
    : deployments;

  const tableColumns = [
    {
      key: 'service',
      header: 'Service',
      render: (d: Deployment) => (
        <div>
          <p className="font-semibold text-white">{d.serviceName}</p>
          <p className="text-xs text-slate-500">{d.namespace}</p>
        </div>
      ),
    },
    {
      key: 'env',
      header: 'Environment',
      width: '130px',
      render: (d: Deployment) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
          d.environmentName?.toLowerCase() === 'production' ? 'bg-red-500/15 text-red-300' :
          d.environmentName?.toLowerCase() === 'staging'    ? 'bg-amber-500/15 text-amber-300' :
                                                              'bg-blue-500/15 text-blue-300'
        }`}>
          {d.environmentName}
        </span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      width: '120px',
      render: (d: Deployment) => <ShortSha sha={d.version} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (d: Deployment) => <StatusBadge status={d.status} size="sm" pulse={d.status === 'running'} />,
    },
    {
      key: 'strategy',
      header: 'Strategy',
      width: '110px',
      render: (d: Deployment) => <Badge color="indigo">{d.strategy.type}</Badge>,
    },
    {
      key: 'duration',
      header: 'Duration',
      width: '90px',
      render: (d: Deployment) => (
        <span className="font-mono text-xs text-slate-400">{formatDuration(d.durationMs)}</span>
      ),
    },
    {
      key: 'time',
      header: 'Deployed',
      width: '110px',
      render: (d: Deployment) => (
        <span className="text-xs text-slate-500">{relativeTime(d.finishedAt || d.startedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (d: Deployment) => (
        <div onClick={(e) => e.stopPropagation()}>
          {d.rollbackAvailable && (d.status === 'failed' || d.status === 'degraded') && (
            <button
              onClick={() => setRollbackTarget(d)}
              className="rounded px-2 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              Rollback
            </button>
          )}
        </div>
      ),
    },
  ];

  // Summary stats
  const healthyCount = deployments.filter((d) => d.status === 'healthy').length;
  const failedCount = deployments.filter((d) => d.status === 'failed').length;
  const prodCount = deployments.filter((d) => d.environmentName?.toLowerCase() === 'production').length;

  return (
    <CiCdLayout title="Deployments">
      <PageHeader
        title="Deployments"
        description="Monitor and manage deployments across all environments"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Deployments' }]}
        actions={
          <Button
            variant="primary"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>}
            onClick={() => {/* deploy modal */ }}
          >
            Deploy
          </Button>
        }
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Total" value={deploymentsTotal} color="slate" loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>} />
        <StatCard label="Healthy" value={healthyCount} color="green" loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><polyline points="20 6 9 17 4 12" /></svg>} />
        <StatCard label="Production" value={prodCount} color="amber" loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>} />
        <StatCard label="Failed" value={failedCount} color="red" loading={loading}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>} />
      </div>

      {/* Filters + View Toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search service or version…"
          className="max-w-xs flex-1"
        />
        <Select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)} options={envOptions} className="w-44" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} className="w-40" />

        {/* View toggle */}
        <div className="ml-auto flex rounded-lg border border-slate-700 overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/40'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/40'}`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-xl bg-slate-700/30" />
              ))}
            </div>
          ) : filteredDeployments.length === 0 ? (
            <EmptyState
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>}
              title="No deployments found"
              description="Start a deployment by running a pipeline"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredDeployments.map((dep) => (
                <DeploymentCard key={dep.id} dep={dep} onRollback={setRollbackTarget} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
          <DataTable
            columns={tableColumns}
            data={filteredDeployments}
            loading={loading}
            keyExtractor={(d) => d.id}
            onRowClick={(d) => navigate(`/cicd/deployments/${d.id}`)}
            emptyState={
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>}
                title="No deployments"
              />
            }
          />
          {deploymentsTotal > PAGE_SIZE && (
            <div className="border-t border-slate-700/40 px-4">
              <Pagination
                page={page}
                totalPages={Math.ceil(deploymentsTotal / PAGE_SIZE)}
                total={deploymentsTotal}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Rollback Confirm */}
      <ConfirmDialog
        isOpen={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        onConfirm={handleRollback}
        loading={rollingBack}
        title="Confirm Rollback"
        description={`This will roll back ${rollbackTarget?.serviceName} in ${rollbackTarget?.environmentName} from ${rollbackTarget?.version?.slice(0, 8)} to ${rollbackTarget?.previousVersion?.slice(0, 8) ?? 'the previous version'}. Are you sure?`}
        confirmLabel="Rollback"
        variant="warning"
      />
    </CiCdLayout>
  );
}
