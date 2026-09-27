// ViBa CI/CD Platform — Remaining Pages (Builds, Environments, Clusters, Settings, Security, Monitoring, Logs, Artifacts, Repositories)

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CiCdLayout } from '../components/CiCdLayout';
import {
  PageHeader, Button, SearchInput, StatusBadge, DataTable, Pagination,
  EmptyState, Badge, StatCard, Select, formatDuration, relativeTime, ShortSha,
  TabBar, LogViewer, Input, Modal, ConfirmDialog,
} from '../components/shared';
import { useCiCdStore } from '../store/cicdStore';
import {
  buildsApi, artifactsApi, environmentsApi, clustersApi, securityApi,
  repositoriesApi, configApi,
} from '../api/cicdApi';
import type {
  Build, Artifact, Environment, Cluster, SecurityScan, Repository,
  PipelineStatus, EnvironmentType,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// BUILDS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function BuildsPage() {
  const navigate = useNavigate();
  const { builds, buildsTotal, setBuilds } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await buildsApi.list({ page, pageSize: PAGE_SIZE, status: statusFilter || undefined });
      setBuilds(res.data, res.pagination.total);
    } finally { setLoading(false); }
  }, [page, statusFilter, setBuilds]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? builds.filter((b) => b.serviceName.toLowerCase().includes(search.toLowerCase()) || b.commitSha.includes(search))
    : builds;

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'running', label: 'Running' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const cols = [
    {
      key: 'service', header: 'Service',
      render: (b: Build) => (
        <div>
          <p className="font-semibold text-white">{b.serviceName}</p>
          <p className="text-xs text-slate-400 font-mono">{b.branch}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', width: '110px',
      render: (b: Build) => <StatusBadge status={b.status} pulse={b.status === 'running'} />,
    },
    {
      key: 'commit', header: 'Commit', width: '120px',
      render: (b: Build) => <ShortSha sha={b.commitSha} />,
    },
    {
      key: 'image', header: 'Image', width: '180px',
      render: (b: Build) => b.imageTag
        ? <code className="text-xs text-indigo-300 truncate block max-w-[180px]">{b.imageTag}</code>
        : <span className="text-slate-500">—</span>,
    },
    {
      key: 'duration', header: 'Duration', width: '90px',
      render: (b: Build) => <span className="font-mono text-xs text-slate-400">{formatDuration(b.durationMs)}</span>,
    },
    {
      key: 'time', header: 'Started', width: '110px',
      render: (b: Build) => <span className="text-xs text-slate-500">{relativeTime(b.startedAt)}</span>,
    },
  ];

  return (
    <CiCdLayout title="Builds">
      <PageHeader
        title="Builds"
        description="All build runs and container images"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Builds' }]}
      />

      <div className="mb-4 grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: buildsTotal },
          { label: 'Running', value: builds.filter((b) => b.status === 'running').length },
          { label: 'Passed', value: builds.filter((b) => b.status === 'passed').length },
          { label: 'Failed', value: builds.filter((b) => b.status === 'failed').length },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-700/40 bg-[#1a1d27] px-4 py-3">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <div className="flex gap-3 border-b border-slate-700/40 px-4 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search builds…" className="max-w-xs flex-1" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} className="w-40" />
        </div>
        <DataTable
          columns={cols} data={filtered} loading={loading}
          keyExtractor={(b) => b.id}
          onRowClick={(b) => navigate(`/cicd/pipelines/${b.pipelineRunId}`)}
          emptyState={<EmptyState icon={<span className="text-3xl">🔨</span>} title="No builds found" description="Builds will appear after pipeline runs" />}
        />
        {buildsTotal > PAGE_SIZE && (
          <div className="border-t border-slate-700/40 px-4">
            <Pagination page={page} totalPages={Math.ceil(buildsTotal / PAGE_SIZE)} total={buildsTotal} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function EnvironmentsPage() {
  const { environments, setEnvironments, upsertEnvironment } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEnv, setEditEnv] = useState<Environment | null>(null);
  const [form, setForm] = useState({ name: '', type: 'development' as EnvironmentType, description: '', approvalRequired: false, autoDeployEnabled: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    environmentsApi.list().then((res) => {
      setEnvironments(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [setEnvironments]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editEnv) {
        const res = await environmentsApi.update(editEnv.id, form as any);
        upsertEnvironment(res.data);
      } else {
        const res = await environmentsApi.create({ ...form, slug: form.name.toLowerCase().replace(/[^a-z0-9]/g, '-'), isActive: true, order: environments.length + 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
        upsertEnvironment(res.data);
      }
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const envTypeColors: Record<EnvironmentType, string> = {
    development: 'bg-blue-500/15 border-blue-500/30',
    staging:     'bg-amber-500/15 border-amber-500/30',
    production:  'bg-red-500/15 border-red-500/30',
    preview:     'bg-purple-500/15 border-purple-500/30',
  };

  return (
    <CiCdLayout title="Environments">
      <PageHeader
        title="Environments"
        description="Manage deployment environments and promotion policies"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Environments' }]}
        actions={
          <Button variant="primary" onClick={() => { setEditEnv(null); setShowForm(true); }}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}>
            New Environment
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-700/30" />)}
        </div>
      ) : environments.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" /></svg>}
          title="No environments"
          description="Create your first environment to start deploying"
          action={{ label: 'Create Environment', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {environments.sort((a, b) => a.order - b.order).map((env) => (
            <div key={env.id} className={`rounded-xl border p-5 ${envTypeColors[env.type]}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-lg font-bold text-white">{env.name}</p>
                  <Badge color={env.type === 'production' ? 'red' : env.type === 'staging' ? 'amber' : 'blue'}>
                    {env.type}
                  </Badge>
                </div>
                <button
                  onClick={() => { setEditEnv(env); setShowForm(true); }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>

              {env.description && <p className="text-sm text-slate-400 mb-4">{env.description}</p>}

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Approval Required</span>
                  <Badge color={env.approvalRequired ? 'amber' : 'slate'}>{env.approvalRequired ? 'Yes' : 'No'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Auto Deploy</span>
                  <Badge color={env.autoDeployEnabled ? 'green' : 'slate'}>{env.autoDeployEnabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                {env.namespace && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Namespace</span>
                    <code className="text-slate-300">{env.namespace}</code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editEnv ? 'Edit Environment' : 'New Environment'} size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="production" />
          <Select label="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EnvironmentType }))}
            options={[{ value: 'development', label: 'Development' }, { value: 'staging', label: 'Staging' }, { value: 'production', label: 'Production' }, { value: 'preview', label: 'Preview' }]} />
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Production environment" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.approvalRequired} onChange={(e) => setForm((f) => ({ ...f, approvalRequired: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-600" />
            <span className="text-sm text-slate-300">Require approval before deployment</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoDeployEnabled} onChange={(e) => setForm((f) => ({ ...f, autoDeployEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-600" />
            <span className="text-sm text-slate-300">Enable auto-deployment</span>
          </label>
        </div>
      </Modal>
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLUSTERS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function ClustersPage() {
  const { clusters, setClusters } = useCiCdStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clustersApi.list().then((res) => {
      setClusters(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [setClusters]);

  return (
    <CiCdLayout title="Clusters">
      <PageHeader
        title="Kubernetes Clusters"
        description="Manage connected clusters across all environments"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Clusters' }]}
        actions={
          <Button variant="primary" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}>
            Add Cluster
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-700/30" />)}
        </div>
      ) : clusters.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><path d="M12 8v8M12 16l-4.5 2M12 16l4.5 2" /></svg>}
          title="No clusters connected"
          description="Add a Kubernetes cluster to start deploying"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-white">{cluster.name}</p>
                    <Badge color={cluster.status === 'healthy' ? 'green' : cluster.status === 'degraded' ? 'amber' : 'red'}>
                      {cluster.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">{cluster.provider} · {cluster.region}</p>
                </div>
                <Badge color="slate">v{cluster.version}</Badge>
              </div>

              {/* Node health */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-lg bg-slate-700/30 px-3 py-2">
                  <p className="text-xs text-slate-500">Nodes</p>
                  <p className="text-sm font-bold text-white">{cluster.readyNodes ?? 0}/{cluster.totalNodes ?? 0} Ready</p>
                </div>
                <div className="rounded-lg bg-slate-700/30 px-3 py-2">
                  <p className="text-xs text-slate-500">Namespaces</p>
                  <p className="text-sm font-bold text-white">{cluster.namespaces?.length ?? 0}</p>
                </div>
              </div>

              {/* Resource usage */}
              {(cluster.cpuUsage !== undefined || cluster.memoryUsage !== undefined) && (
                <div className="space-y-2">
                  {cluster.cpuUsage !== undefined && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>CPU</span><span>{cluster.cpuUsage.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-700/60">
                        <div className={`h-full rounded-full transition-all ${cluster.cpuUsage > 85 ? 'bg-red-500' : cluster.cpuUsage > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                          style={{ width: `${cluster.cpuUsage}%` }} />
                      </div>
                    </div>
                  )}
                  {cluster.memoryUsage !== undefined && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Memory</span><span>{cluster.memoryUsage.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-700/60">
                        <div className={`h-full rounded-full transition-all ${cluster.memoryUsage > 85 ? 'bg-red-500' : cluster.memoryUsage > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${cluster.memoryUsage}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Namespaces */}
              {cluster.namespaces && cluster.namespaces.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  {cluster.namespaces.slice(0, 6).map((ns) => (
                    <code key={ns} className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[10px] text-slate-400">{ns}</code>
                  ))}
                  {cluster.namespaces.length > 6 && (
                    <span className="text-[10px] text-slate-500">+{cluster.namespaces.length - 6} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function SecurityPage() {
  const { scans, setScans } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    securityApi.list().then((res) => {
      setScans(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [setScans]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'scans', label: 'Scans', count: scans.length },
    { id: 'policies', label: 'Policies' },
  ];

  const severityColors: Record<string, string> = {
    critical: 'text-red-400', high: 'text-orange-400',
    medium: 'text-amber-400', low: 'text-blue-400',
  };

  const totalBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  scans.forEach((s) => {
    totalBySeverity.critical += s.summary.critical;
    totalBySeverity.high += s.summary.high;
    totalBySeverity.medium += s.summary.medium;
    totalBySeverity.low += s.summary.low;
  });

  return (
    <CiCdLayout title="Security">
      <PageHeader
        title="Security"
        description="Vulnerability scanning, SAST, dependency checks, and security policies"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Security' }]}
      />

      <div className="mb-6">
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="mb-6 grid grid-cols-4 gap-4">
            {Object.entries(totalBySeverity).map(([sev, count]) => (
              <div key={sev} className={`rounded-xl border bg-[#1a1d27] p-5 ${count > 0 ? 'border-red-500/20' : 'border-slate-700/40'}`}>
                <p className="text-xs text-slate-500 capitalize">{sev}</p>
                <p className={`text-3xl font-bold mt-1 ${count > 0 ? severityColors[sev] : 'text-slate-600'}`}>{count}</p>
              </div>
            ))}
          </div>

          {/* Security posture */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Scans Run', value: scans.length, icon: '🔍', good: true },
              { label: 'Policies Passed', value: scans.filter((s) => s.policyPassed).length, icon: '✅', good: true },
              { label: 'Blocked Builds', value: scans.filter((s) => s.blockedBuild).length, icon: '🚫', good: false },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-5 flex items-center gap-4">
                <span className="text-3xl">{s.icon}</span>
                <div>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.good ? 'text-emerald-400' : s.value > 0 ? 'text-red-400' : 'text-slate-400'}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'scans' && (
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
          <DataTable
            columns={[
              { key: 'type', header: 'Type', render: (s: SecurityScan) => <Badge color="purple">{s.type}</Badge> },
              { key: 'scanner', header: 'Scanner', render: (s: SecurityScan) => <code className="text-xs text-slate-300">{s.scanner}</code> },
              { key: 'findings', header: 'Findings', render: (s: SecurityScan) => (
                <div className="flex gap-2 text-xs">
                  {s.summary.critical > 0 && <span className="text-red-400">C:{s.summary.critical}</span>}
                  {s.summary.high > 0 && <span className="text-orange-400">H:{s.summary.high}</span>}
                  {s.summary.medium > 0 && <span className="text-amber-400">M:{s.summary.medium}</span>}
                  {s.summary.low > 0 && <span className="text-blue-400">L:{s.summary.low}</span>}
                  {!s.summary.critical && !s.summary.high && !s.summary.medium && !s.summary.low && <span className="text-emerald-400">Clean</span>}
                </div>
              )},
              { key: 'policy', header: 'Policy', width: '100px', render: (s: SecurityScan) => <Badge color={s.policyPassed ? 'green' : 'red'}>{s.policyPassed ? 'Pass' : 'Fail'}</Badge> },
              { key: 'status', header: 'Status', width: '110px', render: (s: SecurityScan) => <StatusBadge status={s.status as any} /> },
              { key: 'time', header: 'Scanned', width: '110px', render: (s: SecurityScan) => <span className="text-xs text-slate-500">{relativeTime(s.startedAt)}</span> },
            ]}
            data={scans}
            loading={loading}
            keyExtractor={(s) => s.id}
            emptyState={<EmptyState icon={<span className="text-3xl">🛡</span>} title="No security scans" description="Security scans will appear after build pipeline runs" />}
          />
        </div>
      )}

      {activeTab === 'policies' && (
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-6">
          <p className="text-sm text-slate-400 mb-6">Configure security gates that block builds and deployments when violated.</p>
          <div className="space-y-3">
            {[
              { label: 'Block on Critical Vulnerabilities', key: 'blockOnCritical', enabled: true },
              { label: 'Block on High Vulnerabilities', key: 'blockOnHigh', enabled: true },
              { label: 'Require Image Signing', key: 'requireImageSigning', enabled: false },
              { label: 'Require Dependency Scan', key: 'requireDependencyScan', enabled: true },
              { label: 'Require SAST', key: 'requireSAST', enabled: true },
              { label: 'Require Secret Detection', key: 'requireSecretDetection', enabled: true },
            ].map((policy) => (
              <div key={policy.key} className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-700/20 px-4 py-3">
                <span className="text-sm text-slate-200">{policy.label}</span>
                <div className={`h-5 w-9 rounded-full transition-colors ${policy.enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  <div className={`h-4 w-4 rounded-full bg-white m-0.5 transition-transform ${policy.enabled ? 'translate-x-4' : ''}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARTIFACTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function ArtifactsPage() {
  const { artifacts, artifactsTotal, setArtifacts } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    artifactsApi.list({ page, pageSize: PAGE_SIZE }).then((res) => {
      setArtifacts(res.data, res.pagination.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page, setArtifacts]);

  const filtered = search
    ? artifacts.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : artifacts;

  const typeColors: Record<string, string> = {
    container_image: 'blue', binary: 'purple', archive: 'slate',
    test_report: 'green', coverage_report: 'green', sbom: 'amber',
    security_report: 'red', helm_chart: 'indigo',
  };

  const cols = [
    { key: 'name', header: 'Artifact', render: (a: Artifact) => (
      <div><p className="font-semibold text-white">{a.name}</p><p className="text-xs text-slate-500 font-mono">{a.version}</p></div>
    )},
    { key: 'type', header: 'Type', width: '130px', render: (a: Artifact) => <Badge color={(typeColors[a.type] as any) ?? 'slate'}>{a.type.replace('_', ' ')}</Badge> },
    { key: 'commit', header: 'Commit', width: '120px', render: (a: Artifact) => <ShortSha sha={a.commitSha} /> },
    { key: 'size', header: 'Size', width: '90px', render: (a: Artifact) => (
      <span className="text-xs text-slate-400">{a.sizeBytes ? `${(a.sizeBytes / 1024 / 1024).toFixed(1)} MB` : '—'}</span>
    )},
    { key: 'expiry', header: 'Expires', width: '110px', render: (a: Artifact) => (
      <span className="text-xs text-slate-500">{relativeTime(a.expiresAt)}</span>
    )},
    { key: 'created', header: 'Created', width: '110px', render: (a: Artifact) => (
      <span className="text-xs text-slate-500">{relativeTime(a.createdAt)}</span>
    )},
    { key: 'actions', header: '', width: '60px', render: (a: Artifact) => (
      <button onClick={async (e) => { e.stopPropagation(); const res = await artifactsApi.download(a.id); window.open(res.data.url, '_blank'); }}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors" title="Download">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    )},
  ];

  return (
    <CiCdLayout title="Artifacts">
      <PageHeader title="Artifacts" description="Build artifacts, container images, and reports" breadcrumbs={[{ label: 'Platform' }, { label: 'Artifacts' }]} />
      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <div className="flex gap-3 border-b border-slate-700/40 px-4 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search artifacts…" className="max-w-xs flex-1" />
        </div>
        <DataTable columns={cols} data={filtered} loading={loading} keyExtractor={(a) => a.id}
          emptyState={<EmptyState icon={<span className="text-3xl">📦</span>} title="No artifacts" description="Artifacts are created during pipeline builds" />}
        />
        {artifactsTotal > PAGE_SIZE && (
          <div className="border-t border-slate-700/40 px-4">
            <Pagination page={page} totalPages={Math.ceil(artifactsTotal / PAGE_SIZE)} total={artifactsTotal} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORIES PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function RepositoriesPage() {
  const { repositories, setRepositories } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', fullName: '', provider: 'github' as Repository['provider'], url: '', defaultBranch: 'main', isPrivate: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    repositoriesApi.list().then((res) => { setRepositories(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [setRepositories]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await repositoriesApi.create({ ...form, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
      setRepositories([res.data, ...repositories]);
      setShowAdd(false);
    } finally { setSaving(false); }
  };

  const providerColors: Record<string, string> = { github: 'slate', gitlab: 'amber', bitbucket: 'blue', gitea: 'green', azure_devops: 'purple' };

  return (
    <CiCdLayout title="Repositories">
      <PageHeader title="Repositories" description="Connected source code repositories" breadcrumbs={[{ label: 'Platform' }, { label: 'Repositories' }]}
        actions={
          <Button variant="primary" onClick={() => setShowAdd(true)}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}>
            Connect Repository
          </Button>
        }
      />
      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <DataTable
          columns={[
            { key: 'name', header: 'Repository', render: (r: Repository) => (
              <div><p className="font-semibold text-white">{r.fullName}</p><p className="text-xs text-slate-500 break-all">{r.url}</p></div>
            )},
            { key: 'provider', header: 'Provider', width: '110px', render: (r: Repository) => <Badge color={(providerColors[r.provider] as any) ?? 'slate'}>{r.provider}</Badge> },
            { key: 'branch', header: 'Default Branch', width: '130px', render: (r: Repository) => <code className="text-xs text-slate-300">{r.defaultBranch}</code> },
            { key: 'private', header: 'Visibility', width: '100px', render: (r: Repository) => <Badge color={r.isPrivate ? 'amber' : 'green'}>{r.isPrivate ? 'Private' : 'Public'}</Badge> },
            { key: 'synced', header: 'Last Synced', width: '110px', render: (r: Repository) => <span className="text-xs text-slate-500">{relativeTime(r.lastSyncedAt)}</span> },
            { key: 'actions', header: '', width: '60px', render: (r: Repository) => (
              <button onClick={async (e) => { e.stopPropagation(); await repositoriesApi.sync(r.id); }}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors" title="Sync">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            )},
          ]}
          data={repositories} loading={loading} keyExtractor={(r) => r.id}
          emptyState={<EmptyState icon={<span className="text-3xl">📂</span>} title="No repositories connected" description="Connect a repository to start building pipelines"
            action={{ label: 'Connect Repository', onClick: () => setShowAdd(true) }} />}
        />
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Connect Repository" size="md"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" onClick={handleAdd} loading={saving}>Connect</Button></>}>
        <div className="space-y-4">
          <Select label="Provider" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as any }))}
            options={[{ value: 'github', label: 'GitHub' }, { value: 'gitlab', label: 'GitLab' }, { value: 'bitbucket', label: 'Bitbucket' }, { value: 'gitea', label: 'Gitea' }, { value: 'azure_devops', label: 'Azure DevOps' }]} />
          <Input label="Full Name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value, name: e.target.value.split('/')[1] ?? e.target.value }))} placeholder="org/repository-name" />
          <Input label="Repository URL" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://github.com/org/repo" />
          <Input label="Default Branch" value={form.defaultBranch} onChange={(e) => setForm((f) => ({ ...f, defaultBranch: e.target.value }))} placeholder="main" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm((f) => ({ ...f, isPrivate: e.target.checked }))} className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-600" />
            <span className="text-sm text-slate-300">Private repository (requires authentication)</span>
          </label>
        </div>
      </Modal>
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPage() {
  const { systemConfig, setSystemConfig } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    configApi.get().then((res) => { setSystemConfig(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [setSystemConfig]);

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'security', label: 'Security Policies' },
    { id: 'features', label: 'Feature Flags' },
    { id: 'retention', label: 'Retention' },
  ];

  const handleSave = async (updates: any) => {
    setSaving(true);
    try {
      const res = await configApi.update(updates);
      setSystemConfig(res.data);
    } finally { setSaving(false); }
  };

  return (
    <CiCdLayout title="Settings">
      <PageHeader title="Platform Settings" description="Configure global platform behavior and policies" breadcrumbs={[{ label: 'Platform' }, { label: 'Settings' }]} />

      <div className="mb-6">
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-700/40" />)}</div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-6 space-y-6">
          {activeTab === 'general' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Platform Name" defaultValue={systemConfig?.platformName ?? 'ViBa Platform'}
                  onChange={(e) => handleSave({ platformName: e.target.value })} />
                <Input label="Container Registry URL" defaultValue={systemConfig?.registryUrl ?? ''}
                  placeholder="registry.vibamart.com" onChange={(e) => handleSave({ registryUrl: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Max Concurrent Builds" type="number" defaultValue={String(systemConfig?.maxConcurrentBuilds ?? 10)} />
                <Input label="Max Workers" type="number" defaultValue={String(systemConfig?.maxWorkers ?? 20)} />
                <Input label="Build Timeout (seconds)" type="number" defaultValue={String(systemConfig?.defaultBuildTimeoutSecs ?? 3600)} />
              </div>
              <div className="flex justify-end">
                <Button variant="primary" loading={saving} onClick={() => handleSave({})}>Save Settings</Button>
              </div>
            </>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3">
              {[
                { label: 'Block builds on critical vulnerabilities', key: 'blockOnCritical', value: systemConfig?.securityPolicies?.blockOnCritical ?? true },
                { label: 'Block builds on high vulnerabilities', key: 'blockOnHigh', value: systemConfig?.securityPolicies?.blockOnHigh ?? true },
                { label: 'Require image signing before deployment', key: 'requireImageSigning', value: systemConfig?.securityPolicies?.requireImageSigning ?? false },
                { label: 'Require dependency vulnerability scan', key: 'requireDependencyScan', value: systemConfig?.securityPolicies?.requireDependencyScan ?? true },
                { label: 'Require SAST (static analysis)', key: 'requireSAST', value: systemConfig?.securityPolicies?.requireSAST ?? true },
                { label: 'Require secret detection scan', key: 'requireSecretDetection', value: systemConfig?.securityPolicies?.requireSecretDetection ?? true },
              ].map((policy) => (
                <div key={policy.key} className="flex items-center justify-between rounded-lg border border-slate-700/40 px-4 py-3">
                  <span className="text-sm text-slate-200">{policy.label}</span>
                  <div className={`relative h-5 w-9 rounded-full cursor-pointer ${policy.value ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    onClick={() => handleSave({ securityPolicies: { ...systemConfig?.securityPolicies, [policy.key]: !policy.value } })}>
                    <div className={`absolute h-4 w-4 rounded-full bg-white top-0.5 transition-transform ${policy.value ? 'translate-x-4 left-0.5' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-3">
              {[
                { label: 'GitOps (Argo CD integration)', key: 'gitopsEnabled', value: systemConfig?.featureFlags?.gitopsEnabled ?? false },
                { label: 'Tekton CI pipeline execution', key: 'tektonEnabled', value: systemConfig?.featureFlags?.tektonEnabled ?? false },
                { label: 'HashiCorp Vault secrets', key: 'vaultEnabled', value: systemConfig?.featureFlags?.vaultEnabled ?? false },
                { label: 'Email & Slack notifications', key: 'notificationsEnabled', value: systemConfig?.featureFlags?.notificationsEnabled ?? true },
              ].map((flag) => (
                <div key={flag.key} className="flex items-center justify-between rounded-lg border border-slate-700/40 px-4 py-3">
                  <span className="text-sm text-slate-200">{flag.label}</span>
                  <div className={`relative h-5 w-9 rounded-full cursor-pointer ${flag.value ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    onClick={() => handleSave({ featureFlags: { ...systemConfig?.featureFlags, [flag.key]: !flag.value } })}>
                    <div className={`absolute h-4 w-4 rounded-full bg-white top-0.5 transition-transform ${flag.value ? 'translate-x-4 left-0.5' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'retention' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Artifact Retention (days)" type="number" defaultValue={String(systemConfig?.artifactRetentionDays ?? 90)} />
                <Input label="Audit Log Retention (days)" type="number" defaultValue={String(systemConfig?.auditLogRetentionDays ?? 365)} />
              </div>
              <div className="flex justify-end">
                <Button variant="primary" loading={saving}>Save Retention Policies</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONITORING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function MonitoringPage() {
  const { stats } = useCiCdStore();

  const metrics = [
    { label: 'Pipeline Throughput', value: `${stats?.deploymentFrequency?.toFixed(1) ?? '—'}/day`, description: 'Avg deployments per day', color: 'text-indigo-400' },
    { label: 'Build Success Rate', value: `${stats?.buildSuccessRate?.toFixed(1) ?? '—'}%`, description: 'Successful builds', color: stats && stats.buildSuccessRate >= 90 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Avg Build Time', value: formatDuration(stats?.averageBuildTimeMs), description: 'Mean build duration', color: 'text-blue-400' },
    { label: 'Avg Deploy Time', value: formatDuration(stats?.averageDeploymentTimeMs), description: 'Mean deployment duration', color: 'text-purple-400' },
    { label: 'Active Workers', value: stats?.activeWorkers ?? '—', description: 'Workers processing jobs', color: 'text-slate-300' },
    { label: 'Queue Depth', value: stats?.queueDepth ?? '—', description: 'Jobs waiting to execute', color: stats && stats.queueDepth > 20 ? 'text-red-400' : 'text-slate-300' },
  ];

  return (
    <CiCdLayout title="Monitoring">
      <PageHeader title="Monitoring" description="Platform health metrics and observability" breadcrumbs={[{ label: 'Platform' }, { label: 'Monitoring' }]} />

      <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-300 flex gap-3">
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
        Full metrics integration with Prometheus / OpenTelemetry available. Connect your observability backend in Settings → Feature Flags.
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-5">
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-600 mt-1">{m.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-6">
        <p className="text-sm font-semibold text-white mb-4">System Health</p>
        <div className="grid grid-cols-3 gap-4">
          {['API Server', 'Pipeline Scheduler', 'Worker Pool', 'Database', 'Cache (Redis)', 'Registry'].map((service) => (
            <div key={service} className="flex items-center gap-3 rounded-lg bg-slate-700/20 px-3 py-2.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-slate-300">{service}</span>
              <span className="ml-auto text-xs text-emerald-400">Healthy</span>
            </div>
          ))}
        </div>
      </div>
    </CiCdLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function LogsPage() {
  const [search, setSearch] = useState('');
  const [logs] = useState([
    '[2026-09-27T11:30:00Z] INFO  Pipeline scheduler started. Workers: 10',
    '[2026-09-27T11:30:01Z] INFO  Webhook received: push to main from github.com/org/payment-service',
    '[2026-09-27T11:30:02Z] INFO  Created pipeline run: abc123 for payment-service',
    '[2026-09-27T11:30:03Z] INFO  Job assigned to worker-07: abc123',
    '[2026-09-27T11:30:10Z] INFO  Step [checkout] started on worker-07',
    '[2026-09-27T11:30:15Z] INFO  Step [checkout] passed in 5.2s',
    '[2026-09-27T11:30:16Z] INFO  Step [install] started',
    '[2026-09-27T11:30:45Z] INFO  Step [install] passed in 29.3s (cache HIT)',
    '[2026-09-27T11:30:46Z] INFO  Step [lint] started',
    '[2026-09-27T11:31:02Z] WARN  Step [lint] passed with 2 warnings',
    '[2026-09-27T11:31:03Z] INFO  Step [test] started',
    '[2026-09-27T11:32:15Z] INFO  Step [test] passed in 72.1s — 247 tests, 0 failures',
    '[2026-09-27T11:32:16Z] INFO  Step [security_scan] started',
    '[2026-09-27T11:32:45Z] INFO  Security scan: 0 critical, 1 high, 4 medium findings',
    '[2026-09-27T11:32:46Z] INFO  Step [docker_build] started',
    '[2026-09-27T11:33:30Z] INFO  Step [docker_build] passed in 44.2s',
    '[2026-09-27T11:33:31Z] INFO  Step [docker_push] started',
    '[2026-09-27T11:33:45Z] INFO  Image pushed: registry.vibamart.com/payment-service:a83f91c2',
    '[2026-09-27T11:33:46Z] INFO  Pipeline abc123 completed PASSED in 3m 36s',
    '[2026-09-27T11:33:47Z] INFO  Triggering deployment to development environment',
  ]);

  const filteredLogs = search
    ? logs.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <CiCdLayout title="Logs">
      <PageHeader title="Platform Logs" description="Centralized log stream from the CI/CD platform" breadcrumbs={[{ label: 'Platform' }, { label: 'Logs' }]} />

      <div className="mb-4 flex gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search logs…" className="max-w-sm flex-1" />
        <Button variant="ghost" size="sm"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}>
          Download
        </Button>
      </div>

      <LogViewer logs={filteredLogs.join('\n')} maxHeight="600px" />
    </CiCdLayout>
  );
}
