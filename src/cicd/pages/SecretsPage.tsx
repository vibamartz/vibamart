// ViBa CI/CD Platform — Secrets Management Page
// Shows metadata only — values are NEVER displayed after creation

import React, { useEffect, useState, useCallback } from 'react';
import { CiCdLayout } from '../components/CiCdLayout';
import {
  PageHeader, Button, SearchInput, Badge, DataTable, Pagination,
  EmptyState, Modal, Input, Select, relativeTime, ConfirmDialog,
} from '../components/shared';
import { useCiCdStore } from '../store/cicdStore';
import { secretsApi, environmentsApi } from '../api/cicdApi';
import type { SecretMetadata, SecretType } from '../types';

// ─── Secret Form Modal ────────────────────────────────────────────────────────

interface SecretFormData {
  name: string;
  key: string;
  value: string;
  type: SecretType;
  description: string;
  environmentId: string;
  isRotationEnabled: boolean;
}

const INITIAL: SecretFormData = {
  name: '', key: '', value: '', type: 'env',
  description: '', environmentId: '', isRotationEnabled: false,
};

function SecretFormModal({
  isOpen, onClose, secret, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  secret?: SecretMetadata | null;
  onSuccess: (s: SecretMetadata) => void;
}) {
  const { environments } = useCiCdStore();
  const [form, setForm] = useState<SecretFormData>(INITIAL);
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!secret;

  useEffect(() => {
    if (secret) {
      setForm({
        name: secret.name,
        key: secret.key,
        value: '', // never pre-filled
        type: secret.type,
        description: secret.description ?? '',
        environmentId: secret.environmentId ?? '',
        isRotationEnabled: secret.isRotationEnabled,
      });
    } else {
      setForm(INITIAL);
    }
    setError(null);
  }, [secret, isOpen]);

  const setField = (k: keyof SecretFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      setForm((f) => ({ ...f, [k]: val }));
    };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.key.trim()) { setError('Key is required'); return; }
    if (!isEdit && !form.value.trim()) { setError('Value is required for new secrets'); return; }

    setSaving(true);
    setError(null);
    try {
      let result: SecretMetadata;
      if (isEdit && secret) {
        const res = await secretsApi.update(secret.id, {
          description: form.description,
          isRotationEnabled: form.isRotationEnabled,
          ...(form.value ? { value: form.value } : {}),
        });
        result = res.data;
      } else {
        const res = await secretsApi.create({
          name: form.name,
          key: form.key,
          value: form.value,
          type: form.type,
          description: form.description,
          environmentId: form.environmentId || undefined,
        });
        result = res.data;
      }
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save secret');
    } finally {
      setSaving(false);
    }
  };

  const typeOptions: Array<{ value: string; label: string }> = [
    { value: 'env', label: 'Environment Variable' },
    { value: 'api_key', label: 'API Key' },
    { value: 'password', label: 'Password' },
    { value: 'token', label: 'Token' },
    { value: 'file', label: 'File Secret' },
    { value: 'certificate', label: 'Certificate' },
  ];

  const envOptions = [
    { value: '', label: '— Platform-wide —' },
    ...environments.map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Secret' : 'Create Secret'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Secret'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Security notice */}
        <div className="flex gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-300">
          <svg className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>
            Secret values are encrypted and stored securely. Values are never displayed after creation.
            {isEdit && ' Leave the value field empty to keep the current value.'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Display Name"
            value={form.name}
            onChange={setField('name')}
            placeholder="Database Password"
            disabled={isEdit}
          />
          <Input
            label="Environment Key"
            value={form.key}
            onChange={setField('key')}
            placeholder="DATABASE_PASSWORD"
            disabled={isEdit}
            hint="Used as env var name in builds"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            value={form.type}
            onChange={setField('type') as any}
            options={typeOptions}
            disabled={isEdit}
          />
          <Select
            label="Environment (optional)"
            value={form.environmentId}
            onChange={setField('environmentId') as any}
            options={envOptions}
          />
        </div>

        {/* Value field — masked */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
            {isEdit ? 'New Value (leave empty to keep current)' : 'Secret Value'}
          </label>
          <div className="relative">
            <input
              type={showValue ? 'text' : 'password'}
              value={form.value}
              onChange={setField('value') as any}
              placeholder={isEdit ? '••••••••' : 'Enter secret value…'}
              className="w-full rounded-lg border border-slate-700 bg-[#0f1117] px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowValue((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              {showValue ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <Input
          label="Description (optional)"
          value={form.description}
          onChange={setField('description')}
          placeholder="Used for PostgreSQL connection in production"
        />

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isRotationEnabled}
            onChange={setField('isRotationEnabled') as any}
            className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-300">Enable automatic rotation</span>
        </label>
      </div>
    </Modal>
  );
}

// ─── Secrets Page ─────────────────────────────────────────────────────────────

export default function SecretsPage() {
  const { secrets, secretsLoading, setSecrets, upsertSecret, removeSecret, environments, setEnvironments } = useCiCdStore();
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editSecret, setEditSecret] = useState<SecretMetadata | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretMetadata | null>(null);
  const [rotateTarget, setRotateTarget] = useState<SecretMetadata | null>(null);
  const [rotateValue, setRotateValue] = useState('');
  const [rotating, setRotating] = useState(false);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    try {
      const [secsRes, envsRes] = await Promise.allSettled([
        secretsApi.list({ page, pageSize: PAGE_SIZE, environmentId: envFilter || undefined }),
        environmentsApi.list(),
      ]);
      if (secsRes.status === 'fulfilled') {
        setSecrets(secsRes.value.data);
        setTotal(secsRes.value.pagination.total);
      }
      if (envsRes.status === 'fulfilled') setEnvironments(envsRes.value.data);
    } catch (err) {
      console.error('Failed to load secrets:', err);
    }
  }, [page, envFilter, setSecrets, setEnvironments]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await secretsApi.delete(deleteTarget.id);
      removeSecret(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleRotate = async () => {
    if (!rotateTarget || !rotateValue.trim()) return;
    setRotating(true);
    try {
      const res = await secretsApi.rotate(rotateTarget.id, rotateValue);
      upsertSecret(res.data);
      setRotateTarget(null);
      setRotateValue('');
    } finally {
      setRotating(false);
    }
  };

  const filtered = search
    ? secrets.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.key.toLowerCase().includes(search.toLowerCase()))
    : secrets;

  const envOptions = [
    { value: '', label: 'All Environments' },
    ...environments.map((e) => ({ value: e.id, label: e.name })),
  ];

  const typeColors: Record<string, string> = {
    env: 'blue', api_key: 'purple', password: 'red', token: 'amber',
    file: 'slate', certificate: 'green',
  };

  const columns = [
    {
      key: 'name',
      header: 'Name / Key',
      render: (s: SecretMetadata) => (
        <div>
          <p className="font-semibold text-white">{s.name}</p>
          <code className="text-xs text-slate-400">{s.key}</code>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      width: '120px',
      render: () => (
        <span className="font-mono text-slate-500 tracking-widest">••••••••</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '110px',
      render: (s: SecretMetadata) => (
        <Badge color={(typeColors[s.type] as any) ?? 'slate'}>{s.type}</Badge>
      ),
    },
    {
      key: 'env',
      header: 'Environment',
      width: '130px',
      render: (s: SecretMetadata) => (
        <span className="text-xs text-slate-400">{s.environmentName ?? 'Platform-wide'}</span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      width: '80px',
      render: (s: SecretMetadata) => (
        <Badge color="slate">v{s.version}</Badge>
      ),
    },
    {
      key: 'rotation',
      header: 'Rotation',
      width: '100px',
      render: (s: SecretMetadata) => (
        <div>
          {s.isRotationEnabled ? (
            <Badge color="green">Auto</Badge>
          ) : (
            <Badge color="slate">Manual</Badge>
          )}
          {s.lastRotatedAt && (
            <p className="text-[10px] text-slate-600 mt-0.5">{relativeTime(s.lastRotatedAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      render: (s: SecretMetadata) => (
        <Badge color={s.isActive ? 'green' : 'red'}>{s.isActive ? 'Active' : 'Disabled'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      render: (s: SecretMetadata) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setEditSecret(s); setShowForm(true); }}
            title="Edit"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => setRotateTarget(s)}
            title="Rotate"
            className="rounded p-1.5 text-slate-400 hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          <button
            onClick={() => setDeleteTarget(s)}
            title="Delete"
            className="rounded p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
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
    <CiCdLayout title="Secrets">
      <PageHeader
        title="Secrets Management"
        description="Manage encrypted credentials and configuration secrets. Values are never exposed after creation."
        breadcrumbs={[{ label: 'Platform' }, { label: 'Secrets' }]}
        actions={
          <Button
            variant="primary"
            onClick={() => { setEditSecret(null); setShowForm(true); }}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          >
            New Secret
          </Button>
        }
      />

      {/* Security banner */}
      <div className="mb-4 flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <svg className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <div className="text-sm text-emerald-300">
          <span className="font-semibold">Secure Storage: </span>
          Secret values are encrypted at rest using AES-256. Only metadata is stored in this database.
          Values are injected at build/deploy time via the secrets manager and are never logged or exposed in the UI.
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-4">
        {[
          { label: 'Total Secrets', value: total },
          { label: 'Active', value: secrets.filter((s) => s.isActive).length },
          { label: 'Auto-Rotate', value: secrets.filter((s) => s.isRotationEnabled).length },
          { label: 'Expiring Soon', value: secrets.filter((s) => s.expiresAt && new Date(s.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-700/40 bg-[#1a1d27] px-4 py-3">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="text-xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/40 px-4 py-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search secrets…"
            className="max-w-xs flex-1"
          />
          <Select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            options={envOptions}
            className="w-44"
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={secretsLoading}
          keyExtractor={(s) => s.id}
          emptyState={
            <EmptyState
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
              title="No secrets found"
              description="Create your first secret to get started"
              action={{ label: 'Create Secret', onClick: () => { setEditSecret(null); setShowForm(true); } }}
            />
          }
        />

        {total > PAGE_SIZE && (
          <div className="border-t border-slate-700/40 px-4">
            <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <SecretFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditSecret(null); }}
        secret={editSecret}
        onSuccess={(s) => upsertSecret(s)}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Secret"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This cannot be undone and may break services that depend on this secret.`}
        confirmLabel="Delete Secret"
        variant="danger"
      />

      {/* Rotate Modal */}
      <Modal
        isOpen={!!rotateTarget}
        onClose={() => { setRotateTarget(null); setRotateValue(''); }}
        title={`Rotate Secret — ${rotateTarget?.name}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRotateTarget(null); setRotateValue(''); }} disabled={rotating}>Cancel</Button>
            <Button variant="primary" onClick={handleRotate} loading={rotating} disabled={!rotateValue.trim()}>
              Rotate
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-300">
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            This will increment the secret version and update all services that reference it.
          </div>
          <Input
            label="New Secret Value"
            type="password"
            value={rotateValue}
            onChange={(e) => setRotateValue(e.target.value)}
            placeholder="Enter new value…"
          />
        </div>
      </Modal>
    </CiCdLayout>
  );
}
