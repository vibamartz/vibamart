// ViBa CI/CD Platform — Audit Logs Page

import React, { useEffect, useState, useCallback } from 'react';
import { CiCdLayout } from '../components/CiCdLayout';
import {
  PageHeader, Button, SearchInput, Badge, DataTable, Pagination,
  EmptyState, Select, relativeTime, Modal,
} from '../components/shared';
import { useCiCdStore } from '../store/cicdStore';
import { auditApi } from '../api/cicdApi';
import type { AuditLog, AuditAction } from '../types';

// ─── Action color mapping ─────────────────────────────────────────────────────

function getActionColor(action: AuditAction | string): 'green' | 'blue' | 'red' | 'amber' | 'purple' | 'slate' {
  if (action.startsWith('deployment')) return 'green';
  if (action.startsWith('pipeline') || action.startsWith('build')) return 'blue';
  if (action.startsWith('secret')) return 'amber';
  if (action.startsWith('service')) return 'purple';
  if (action.includes('delete') || action.includes('rollback')) return 'red';
  return 'slate';
}

function getActionIcon(action: AuditAction | string) {
  if (action.startsWith('user.login')) return '🔐';
  if (action.startsWith('deployment')) return '🚀';
  if (action.startsWith('pipeline')) return '⚡';
  if (action.startsWith('build')) return '🔨';
  if (action.startsWith('secret')) return '🔑';
  if (action.startsWith('service')) return '⚙️';
  if (action.includes('rollback')) return '↩';
  if (action.includes('delete')) return '🗑';
  if (action.includes('permission')) return '👤';
  return '📋';
}

// ─── Audit Detail Modal ───────────────────────────────────────────────────────

function AuditDetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <Modal isOpen={!!log} onClose={onClose} title="Audit Log Detail" size="lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getActionIcon(log.action)}</span>
          <div>
            <p className="font-semibold text-white">{log.action}</p>
            <p className="text-xs text-slate-400">{relativeTime(log.timestamp)}</p>
          </div>
          <Badge color={log.result === 'success' ? 'green' : 'red'} className="ml-auto">
            {log.result}
          </Badge>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'User', value: log.userEmail },
            { label: 'Resource Type', value: log.resourceType },
            { label: 'Resource', value: log.resourceName ?? '—' },
            { label: 'IP Address', value: log.ipAddress ?? '—' },
            { label: 'Timestamp', value: new Date(log.timestamp).toLocaleString() },
            { label: 'User Agent', value: log.userAgent ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-slate-700/30 px-3 py-2">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-slate-200 font-mono text-xs mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Details JSON */}
        {Object.keys(log.details ?? {}).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Event Details</p>
            <pre className="overflow-auto rounded-lg bg-[#0a0c10] p-3 text-xs text-slate-300 max-h-40">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>
        )}

        {/* Integrity */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          <span className="font-semibold">Integrity hash: </span>
          <code className="font-mono">{log.integrityHash?.slice(0, 32)}…</code>
        </div>
      </div>
    </Modal>
  );
}

// ─── Audit Logs Page ──────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { auditLogs, auditLogsTotal, setAuditLogs } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        page, pageSize: PAGE_SIZE,
        action: actionFilter || undefined,
      });
      setAuditLogs(res.data, res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, setAuditLogs]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await auditApi.export();
      window.open(res.data.url, '_blank');
    } finally {
      setExporting(false);
    }
  };

  const filtered = search
    ? auditLogs.filter((l) =>
        l.action.includes(search.toLowerCase()) ||
        l.userEmail.toLowerCase().includes(search.toLowerCase()) ||
        l.resourceName?.toLowerCase().includes(search.toLowerCase())
      )
    : auditLogs;

  const filteredByResult = resultFilter
    ? filtered.filter((l) => l.result === resultFilter)
    : filtered;

  const actionOptions = [
    { value: '', label: 'All Actions' },
    { value: 'user', label: 'User Auth' },
    { value: 'service', label: 'Services' },
    { value: 'pipeline', label: 'Pipelines' },
    { value: 'build', label: 'Builds' },
    { value: 'deployment', label: 'Deployments' },
    { value: 'secret', label: 'Secrets' },
    { value: 'permission', label: 'Permissions' },
    { value: 'settings', label: 'Settings' },
  ];

  const resultOptions = [
    { value: '', label: 'All Results' },
    { value: 'success', label: 'Success' },
    { value: 'failure', label: 'Failure' },
  ];

  const columns = [
    {
      key: 'action',
      header: 'Action',
      render: (l: AuditLog) => (
        <div className="flex items-center gap-2">
          <span className="text-base">{getActionIcon(l.action)}</span>
          <div>
            <p className="font-mono text-xs text-slate-200">{l.action}</p>
            {l.resourceName && (
              <p className="text-xs text-slate-500 truncate max-w-xs">{l.resourceName}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      width: '180px',
      render: (l: AuditLog) => (
        <p className="text-xs text-slate-300 truncate">{l.userEmail}</p>
      ),
    },
    {
      key: 'resource',
      header: 'Resource Type',
      width: '140px',
      render: (l: AuditLog) => (
        <Badge color={getActionColor(l.action)}>{l.resourceType}</Badge>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      width: '90px',
      render: (l: AuditLog) => (
        <Badge color={l.result === 'success' ? 'green' : 'red'}>{l.result}</Badge>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      width: '110px',
      render: (l: AuditLog) => (
        <code className="text-xs text-slate-500">{l.ipAddress ?? '—'}</code>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      width: '110px',
      render: (l: AuditLog) => (
        <span className="text-xs text-slate-500">{relativeTime(l.timestamp)}</span>
      ),
    },
  ];

  // Action summary by type
  const actionSummary: Record<string, number> = {};
  auditLogs.forEach((l) => {
    const prefix = l.action.split('.')[0];
    actionSummary[prefix] = (actionSummary[prefix] ?? 0) + 1;
  });

  return (
    <CiCdLayout title="Audit Logs">
      <PageHeader
        title="Audit Logs"
        description="Tamper-resistant audit trail of all platform actions"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Audit Logs' }]}
        actions={
          <Button
            variant="secondary"
            loading={exporting}
            onClick={handleExport}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            }
          >
            Export CSV
          </Button>
        }
      />

      {/* Tamper-resistance notice */}
      <div className="mb-4 flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
        <svg className="h-5 w-5 flex-shrink-0 mt-0.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        Each audit record is cryptographically signed. Any tampering with the log record will be detectable via integrity hash verification.
      </div>

      {/* Activity summary cards */}
      {Object.keys(actionSummary).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {Object.entries(actionSummary).map(([type, count]) => (
            <div key={type} className="rounded-lg border border-slate-700/40 bg-[#1a1d27] px-4 py-2.5 flex items-center gap-3">
              <span className="text-lg">{getActionIcon(type + '.')}</span>
              <div>
                <p className="text-xs text-slate-500 capitalize">{type}</p>
                <p className="text-sm font-bold text-white">{count}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/40 px-4 py-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by action, user, or resource…"
            className="max-w-sm flex-1"
          />
          <Select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            options={actionOptions}
            className="w-40"
          />
          <Select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            options={resultOptions}
            className="w-36"
          />
          <span className="text-xs text-slate-500 ml-auto">{auditLogsTotal} events</span>
        </div>

        <DataTable
          columns={columns}
          data={filteredByResult}
          loading={loading}
          keyExtractor={(l) => l.id}
          onRowClick={(l) => setSelectedLog(l)}
          emptyState={
            <EmptyState
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><path d="M9 11l3 3L22 4" /></svg>}
              title="No audit logs found"
              description="Platform activity will appear here"
            />
          }
        />

        {auditLogsTotal > PAGE_SIZE && (
          <div className="border-t border-slate-700/40 px-4">
            <Pagination
              page={page}
              totalPages={Math.ceil(auditLogsTotal / PAGE_SIZE)}
              total={auditLogsTotal}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {selectedLog && <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </CiCdLayout>
  );
}
