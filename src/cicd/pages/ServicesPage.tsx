// ViBa CI/CD Platform — Services Management Page

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CiCdLayout } from '../components/CiCdLayout';
import {
  PageHeader, Button, SearchInput, Badge, EmptyState, DataTable,
  Pagination, StatusBadge, Modal, Input, Select, relativeTime,
} from '../components/shared';
import { useCiCdStore } from '../store/cicdStore';
import { servicesApi, repositoriesApi, templatesApi, environmentsApi } from '../api/cicdApi';
import type { Service, RuntimeType, RepositoryProvider } from '../types';

// ─── Runtime Badges ───────────────────────────────────────────────────────────

const RUNTIME_COLORS: Record<RuntimeType | string, BadgeColor> = {
  nodejs:  'green',
  python:  'blue',
  java:    'amber',
  go:      'blue',
  cpp:     'purple',
  rust:    'red',
  ruby:    'red',
  php:     'purple',
  dotnet:  'blue',
  docker:  'slate',
};

type BadgeColor = 'green' | 'blue' | 'red' | 'amber' | 'purple' | 'slate' | 'indigo';

// ─── Create/Edit Service Modal ────────────────────────────────────────────────

interface ServiceFormData {
  name: string;
  description: string;
  repositoryId: string;
  defaultBranch: string;
  runtime: RuntimeType;
  runtimeVersion: string;
  dockerfilePath: string;
  buildCommand: string;
  testCommand: string;
  port: string;
  pipelineTemplateId: string;
  namespace: string;
  autoDeployBranch: string;
}

const INITIAL_FORM: ServiceFormData = {
  name: '', description: '', repositoryId: '', defaultBranch: 'main',
  runtime: 'nodejs', runtimeVersion: '', dockerfilePath: 'Dockerfile',
  buildCommand: '', testCommand: '', port: '3000', pipelineTemplateId: '',
  namespace: 'default', autoDeployBranch: '',
};

function ServiceFormModal({
  isOpen, onClose, service, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  service?: Service | null;
  onSuccess: (s: Service) => void;
}) {
  const { repositories, templates } = useCiCdStore();
  const [form, setForm] = useState<ServiceFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name,
        description: service.description,
        repositoryId: service.repositoryId,
        defaultBranch: service.defaultBranch,
        runtime: service.runtime,
        runtimeVersion: service.runtimeVersion ?? '',
        dockerfilePath: service.dockerfilePath,
        buildCommand: service.buildCommand ?? '',
        testCommand: service.testCommand ?? '',
        port: String(service.port),
        pipelineTemplateId: service.pipelineTemplateId,
        namespace: service.namespace ?? 'default',
        autoDeployBranch: service.autoDeployBranch ?? '',
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setError(null);
  }, [service, isOpen]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (k: keyof ServiceFormData) => (e: React.ChangeEvent<any>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Service name is required'); return; }
    if (!form.repositoryId) { setError('Repository is required'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        port: parseInt(form.port) || 3000,
        slug: form.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        isActive: true,
        ownerId: 'current-user',
        createdBy: 'current-user',
        deploymentStrategy: { type: 'rolling' as const, maxUnavailable: 0, maxSurge: 1 },
        healthCheck: { type: 'http' as const, path: '/health', port: parseInt(form.port) || 3000 },
        resources: {
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '500m', memory: '512Mi' },
        },
      };

      let result: Service;
      if (service) {
        const res = await servicesApi.update(service.id, payload as any);
        result = res.data;
      } else {
        const res = await servicesApi.create(payload as any);
        result = res.data;
      }
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const repoOptions = [
    { value: '', label: '— Select repository —' },
    ...repositories.map((r) => ({ value: r.id, label: r.fullName })),
  ];

  const templateOptions = [
    { value: '', label: '— Select pipeline template —' },
    ...templates.map((t) => ({ value: t.id, label: `${t.name} (${t.runtime})` })),
  ];

  const runtimeOptions: Array<{ value: string; label: string }> = [
    { value: 'nodejs', label: 'Node.js' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'go', label: 'Go' },
    { value: 'cpp', label: 'C++' },
    { value: 'rust', label: 'Rust' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'php', label: 'PHP' },
    { value: 'dotnet', label: '.NET' },
    { value: 'docker', label: 'Generic Docker' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={service ? 'Edit Service' : 'Create Service'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit as any} loading={saving}>
            {service ? 'Save Changes' : 'Create Service'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input label="Service Name" value={form.name} onChange={set('name')}
            placeholder="payment-service" required />
          <Select label="Runtime" value={form.runtime} onChange={set('runtime') as any}
            options={runtimeOptions} />
        </div>

        <Input label="Description" value={form.description} onChange={set('description')}
          placeholder="Handles payment processing" />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Repository" value={form.repositoryId} onChange={set('repositoryId') as any}
            options={repoOptions} />
          <Input label="Default Branch" value={form.defaultBranch} onChange={set('defaultBranch')}
            placeholder="main" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Runtime Version" value={form.runtimeVersion} onChange={set('runtimeVersion')}
            placeholder="18.x / 3.11 / 17" />
          <Input label="Port" value={form.port} onChange={set('port')} type="number" placeholder="3000" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Dockerfile Path" value={form.dockerfilePath} onChange={set('dockerfilePath')}
            placeholder="Dockerfile" />
          <Input label="Kubernetes Namespace" value={form.namespace} onChange={set('namespace')}
            placeholder="default" />
        </div>

        <Input label="Build Command" value={form.buildCommand} onChange={set('buildCommand')}
          placeholder="npm run build" />
        <Input label="Test Command" value={form.testCommand} onChange={set('testCommand')}
          placeholder="npm test" />

        <Select label="Pipeline Template" value={form.pipelineTemplateId}
          onChange={set('pipelineTemplateId') as any} options={templateOptions} />

        <Input label="Auto-Deploy Branch (optional)" value={form.autoDeployBranch}
          onChange={set('autoDeployBranch')} placeholder="main"
          hint="Pushes to this branch trigger automatic deployment to development" />
      </form>
    </Modal>
  );
}

// ─── Services Page ────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const navigate = useNavigate();
  const { services, servicesTotal, setServices, upsertService, removeService, repositories, templates, environments, setRepositories, setTemplates, setEnvironments } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Service | null>(null);
  const PAGE_SIZE = 20;

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await servicesApi.list({ page, pageSize: PAGE_SIZE, search: search || undefined });
      setServices(res.data, res.pagination.total);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, setServices]);

  useEffect(() => {
    // Load repos, templates, envs for form dropdowns
    Promise.allSettled([
      repositoriesApi.list({ pageSize: 100 }),
      templatesApi.list(),
      environmentsApi.list(),
    ]).then(([reposRes, tmplRes, envRes]) => {
      if (reposRes.status === 'fulfilled') setRepositories(reposRes.value.data);
      if (tmplRes.status === 'fulfilled') setTemplates(tmplRes.value.data);
      if (envRes.status === 'fulfilled') setEnvironments(envRes.value.data);
    });
  }, [setRepositories, setTemplates, setEnvironments]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await servicesApi.delete(deleteConfirm.id);
      removeService(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Service',
      render: (s: Service) => (
        <div>
          <p className="font-semibold text-white">{s.name}</p>
          <p className="text-xs text-slate-500 truncate max-w-xs">{s.description}</p>
        </div>
      ),
    },
    {
      key: 'runtime',
      header: 'Runtime',
      width: '120px',
      render: (s: Service) => (
        <Badge color={RUNTIME_COLORS[s.runtime] ?? 'slate'}>{s.runtime}</Badge>
      ),
    },
    {
      key: 'namespace',
      header: 'Namespace',
      width: '140px',
      render: (s: Service) => (
        <code className="text-xs text-slate-400 bg-slate-700/40 px-2 py-0.5 rounded">
          {s.namespace ?? 'default'}
        </code>
      ),
    },
    {
      key: 'strategy',
      header: 'Strategy',
      width: '120px',
      render: (s: Service) => (
        <Badge color="indigo">{s.deploymentStrategy.type}</Badge>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      width: '100px',
      render: (s: Service) => (
        <StatusBadge status={s.isActive ? 'healthy' : 'unknown'} size="sm" />
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      width: '120px',
      render: (s: Service) => (
        <span className="text-slate-400">{relativeTime(s.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (s: Service) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setEditService(s); setShowForm(true); }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors"
            title="Edit service"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => setDeleteConfirm(s)}
            className="rounded p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
            title="Delete service"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <CiCdLayout title="Services">
      <PageHeader
        title="Services"
        description="Manage all microservices and applications in your platform"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Services' }]}
        actions={
          <Button
            variant="primary"
            onClick={() => { setEditService(null); setShowForm(true); }}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            New Service
          </Button>
        }
      />

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: servicesTotal, color: 'text-white' },
          { label: 'Active', value: services.filter((s) => s.isActive).length, color: 'text-emerald-400' },
          { label: 'Node.js', value: services.filter((s) => s.runtime === 'nodejs').length, color: 'text-green-400' },
          { label: 'Python', value: services.filter((s) => s.runtime === 'python').length, color: 'text-blue-400' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-700/40 bg-[#1a1d27] px-4 py-3">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Table */}
      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-700/40 px-4 py-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search services…"
            className="max-w-xs"
          />
          <span className="text-xs text-slate-500">
            {servicesTotal} service{servicesTotal !== 1 ? 's' : ''}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={services}
          loading={loading}
          keyExtractor={(s) => s.id}
          onRowClick={(s) => navigate(`/cicd/services/${s.id}`)}
          emptyState={
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10">
                  <rect x="2" y="2" width="20" height="8" rx="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" />
                </svg>
              }
              title="No services found"
              description={search ? `No services match "${search}"` : 'Create your first service to get started'}
              action={!search ? {
                label: 'Create Service',
                onClick: () => { setEditService(null); setShowForm(true); },
              } : undefined}
            />
          }
        />

        {servicesTotal > PAGE_SIZE && (
          <div className="border-t border-slate-700/40 px-4">
            <Pagination
              page={page}
              totalPages={Math.ceil(servicesTotal / PAGE_SIZE)}
              total={servicesTotal}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <ServiceFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditService(null); }}
        service={editService}
        onSuccess={(s) => upsertService(s)}
      />

      {/* Delete Confirm */}
      {deleteConfirm && (
        <Modal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Service"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-slate-400">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-white">{deleteConfirm.name}</span>?
            This action cannot be undone and will remove all associated pipeline history.
          </p>
        </Modal>
      )}
    </CiCdLayout>
  );
}
