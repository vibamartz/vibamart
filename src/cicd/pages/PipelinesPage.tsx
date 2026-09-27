// ViBa CI/CD Platform — Pipelines Page + Pipeline Detail

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CiCdLayout } from '../components/CiCdLayout';
import {
  PageHeader, Button, SearchInput, StatusBadge, DataTable, Pagination,
  EmptyState, LogViewer, TabBar, formatDuration, relativeTime, ShortSha,
  Badge, Modal, Select,
} from '../components/shared';
import { useCiCdStore } from '../store/cicdStore';
import { pipelinesApi, servicesApi } from '../api/cicdApi';
import type { PipelineRun, PipelineStepRun, PipelineStatus } from '../types';

// ─── Step Timeline ────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: PipelineStatus | string }) {
  if (status === 'passed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-emerald-400">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === 'failed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-red-400">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  }
  if (status === 'running') {
    return <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin text-blue-400" stroke="currentColor" strokeWidth="2"><circle className="opacity-25" cx="12" cy="12" r="10" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>;
  }
  if (status === 'skipped') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-500"><polyline points="5 12 19 12" /><polyline points="13 6 19 12 13 18" /></svg>;
  }
  return <span className="h-4 w-4 rounded-full border-2 border-slate-600 bg-slate-800 block" />;
}

function PipelineStepRow({
  step, index, onViewLogs,
}: {
  step: PipelineStepRun;
  index: number;
  onViewLogs: (step: PipelineStepRun) => void | Promise<void>;
  key?: React.Key;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-colors ${
        step.status === 'running' ? 'bg-blue-500/5 border border-blue-500/20' :
        step.status === 'failed'  ? 'bg-red-500/5 border border-red-500/20' :
        step.status === 'passed'  ? 'bg-emerald-500/5 border border-slate-700/20' :
                                    'border border-slate-700/20'
      }`}
    >
      {/* Step number + icon */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="text-xs font-mono text-slate-600 w-5 text-right">{index + 1}</span>
        <StepIcon status={step.status} />
      </div>

      {/* Name */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${
          step.status === 'failed' ? 'text-red-300' :
          step.status === 'passed' ? 'text-slate-200' :
          step.status === 'running' ? 'text-blue-300' : 'text-slate-400'
        }`}>
          {step.name}
        </p>
        {step.errorMessage && (
          <p className="text-xs text-red-400 mt-0.5 truncate">{step.errorMessage}</p>
        )}
      </div>

      {/* Duration */}
      <div className="flex-shrink-0 text-xs text-slate-500 font-mono w-16 text-right">
        {formatDuration(step.durationMs)}
      </div>

      {/* Status + Logs button */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <StatusBadge status={step.status} size="sm" pulse={step.status === 'running'} />
        <button
          onClick={() => onViewLogs(step)}
          className="rounded p-1 text-slate-500 hover:bg-slate-700/60 hover:text-slate-200 transition-colors"
          title="View logs"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Pipeline Detail ──────────────────────────────────────────────────────────

export function PipelineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedPipeline, setSelectedPipeline } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('steps');
  const [selectedStep, setSelectedStep] = useState<PipelineStepRun | null>(null);
  const [stepLogs, setStepLogs] = useState<string | undefined>();
  const [logsLoading, setLogsLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPipeline = useCallback(async () => {
    if (!id) return;
    try {
      const res = await pipelinesApi.get(id);
      setSelectedPipeline(res.data);
    } catch {
      // handle 404
    } finally {
      setLoading(false);
    }
  }, [id, setSelectedPipeline]);

  useEffect(() => {
    loadPipeline();
    // Poll while running
    pollingRef.current = setInterval(() => {
      if (selectedPipeline?.status === 'running' || selectedPipeline?.status === 'queued') {
        loadPipeline();
      }
    }, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadPipeline, selectedPipeline?.status]);

  const handleViewLogs = async (step: PipelineStepRun) => {
    setSelectedStep(step);
    setLogsLoading(true);
    try {
      if (id && step.id) {
        const res = await pipelinesApi.getStepLogs(id, step.id);
        setStepLogs(res.data.logs);
      }
    } catch {
      setStepLogs('Failed to load logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setCancelling(true);
    try {
      await pipelinesApi.cancel(id);
      await loadPipeline();
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await pipelinesApi.retry(id);
      await loadPipeline();
    } finally {
      setRetrying(false);
    }
  };

  const p = selectedPipeline;
  const tabs = [
    { id: 'steps', label: 'Pipeline Steps', count: p?.steps.length },
    { id: 'logs', label: 'Full Logs' },
  ];

  if (loading) {
    return (
      <CiCdLayout title="Pipeline">
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-700/40" />
          ))}
        </div>
      </CiCdLayout>
    );
  }

  if (!p) {
    return (
      <CiCdLayout title="Pipeline Not Found">
        <EmptyState
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>}
          title="Pipeline not found"
          description="This pipeline may have been deleted or the ID is incorrect."
          action={{ label: '← Back to Pipelines', onClick: () => navigate('/cicd/pipelines') }}
        />
      </CiCdLayout>
    );
  }

  const failedSteps = p.steps.filter((s) => s.status === 'failed');
  const passedSteps = p.steps.filter((s) => s.status === 'passed');
  const runningStep = p.steps.find((s) => s.status === 'running');

  return (
    <CiCdLayout title={`Pipeline — ${p.serviceName}`}>
      <PageHeader
        title={`${p.serviceName} — Pipeline Run`}
        breadcrumbs={[
          { label: 'Pipelines', onClick: () => navigate('/cicd/pipelines') },
          { label: p.id.slice(0, 8) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {(p.status === 'running' || p.status === 'queued') && (
              <Button variant="danger" size="sm" loading={cancelling} onClick={handleCancel}>
                Cancel
              </Button>
            )}
            {(p.status === 'failed' || p.status === 'cancelled') && (
              <Button variant="primary" size="sm" loading={retrying} onClick={handleRetry}>
                Retry
              </Button>
            )}
          </div>
        }
      />

      {/* Meta info */}
      <div className="mb-6 rounded-xl border border-slate-700/40 bg-[#1a1d27] p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <div className="mt-1"><StatusBadge status={p.status} pulse={p.status === 'running'} /></div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Service</p>
            <button
              className="mt-1 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
              onClick={() => navigate(`/cicd/services/${p.serviceId}`)}
            >
              {p.serviceName}
            </button>
          </div>
          <div>
            <p className="text-xs text-slate-500">Branch</p>
            <p className="mt-1 text-sm font-mono text-slate-200">{p.branch}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Commit</p>
            <div className="mt-1"><ShortSha sha={p.commitSha} /></div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Duration</p>
            <p className="mt-1 text-sm text-slate-200 font-mono">{formatDuration(p.durationMs)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Triggered</p>
            <p className="mt-1 text-sm text-slate-200">{relativeTime(p.queuedAt)}</p>
          </div>
        </div>

        {p.commitMessage && (
          <div className="mt-4 border-t border-slate-700/40 pt-4">
            <p className="text-xs text-slate-500">Commit message</p>
            <p className="mt-1 text-sm text-slate-300">{p.commitMessage}</p>
          </div>
        )}

        {/* Progress bar */}
        {p.status === 'running' && (
          <div className="mt-4 border-t border-slate-700/40 pt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>
                {runningStep ? `Running: ${runningStep.name}` : 'Processing…'}
              </span>
              <span>
                {passedSteps.length}/{p.steps.length} steps completed
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/60">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(passedSteps.length / Math.max(p.steps.length, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error summary */}
        {p.status === 'failed' && p.errorSummary && (
          <div className="mt-4 border-t border-slate-700/40 pt-4 rounded-lg bg-red-500/10 border-red-500/20 p-3">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-red-300">Build Failed</p>
                <p className="text-xs text-red-400 mt-0.5">{p.errorSummary}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Steps / Logs tabs */}
      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <div className="px-4 pt-4">
          <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="p-4">
          {activeTab === 'steps' && (
            <div className="space-y-2">
              {p.steps.length === 0 ? (
                <EmptyState
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8"><circle cx="12" cy="12" r="3" /><path d="M3 12h6M15 12h6" /></svg>}
                  title="No steps"
                  description="Pipeline steps will appear here once execution begins"
                />
              ) : (
                p.steps.map((step, i) => (
                  <PipelineStepRow
                    key={step.id}
                    step={step}
                    index={i}
                    onViewLogs={handleViewLogs}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <LogViewer logs={p.steps.map((s) => `[${s.name}] ${s.status}`).join('\n')} maxHeight="500px" />
          )}
        </div>
      </div>

      {/* Step Logs Modal */}
      {selectedStep && (
        <Modal
          isOpen={!!selectedStep}
          onClose={() => { setSelectedStep(null); setStepLogs(undefined); }}
          title={`Logs — ${selectedStep.name}`}
          size="xl"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={selectedStep.status} />
              <span className="text-xs text-slate-400">{formatDuration(selectedStep.durationMs)}</span>
            </div>
            {selectedStep.errorMessage && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                {selectedStep.errorMessage}
              </div>
            )}
            <LogViewer logs={stepLogs} loading={logsLoading} maxHeight="400px" />
          </div>
        </Modal>
      )}
    </CiCdLayout>
  );
}

// ─── Pipelines List Page ──────────────────────────────────────────────────────

export default function PipelinesPage() {
  const navigate = useNavigate();
  const { pipelines, pipelinesTotal, setPipelines } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pipelinesApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: (statusFilter as any) || undefined,
      });
      setPipelines(res.data, res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, setPipelines]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh if any running
  useEffect(() => {
    const hasActive = pipelines.some((p) => p.status === 'running' || p.status === 'queued');
    if (!hasActive) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [pipelines, load]);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'queued', label: 'Queued' },
    { value: 'running', label: 'Running' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const columns = [
    {
      key: 'service',
      header: 'Service / Branch',
      render: (p: PipelineRun) => (
        <div>
          <p className="font-semibold text-white">{p.serviceName}</p>
          <p className="text-xs text-slate-400 font-mono">{p.branch}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (p: PipelineRun) => (
        <StatusBadge status={p.status} pulse={p.status === 'running'} />
      ),
    },
    {
      key: 'commit',
      header: 'Commit',
      width: '130px',
      render: (p: PipelineRun) => <ShortSha sha={p.commitSha} />,
    },
    {
      key: 'steps',
      header: 'Steps',
      width: '120px',
      render: (p: PipelineRun) => {
        const passed = p.steps.filter((s) => s.status === 'passed').length;
        const failed = p.steps.filter((s) => s.status === 'failed').length;
        return (
          <div className="flex items-center gap-1.5 text-xs">
            {passed > 0 && <span className="text-emerald-400">✓{passed}</span>}
            {failed > 0 && <span className="text-red-400">✗{failed}</span>}
            <span className="text-slate-500">/{p.steps.length}</span>
          </div>
        );
      },
    },
    {
      key: 'duration',
      header: 'Duration',
      width: '90px',
      render: (p: PipelineRun) => (
        <span className="font-mono text-xs text-slate-400">{formatDuration(p.durationMs)}</span>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger',
      width: '100px',
      render: (p: PipelineRun) => <Badge color="slate">{p.trigger}</Badge>,
    },
    {
      key: 'time',
      header: 'Queued',
      width: '110px',
      render: (p: PipelineRun) => (
        <span className="text-xs text-slate-500">{relativeTime(p.queuedAt)}</span>
      ),
    },
  ];

  return (
    <CiCdLayout title="Pipelines">
      <PageHeader
        title="Pipelines"
        description="All pipeline runs across your services"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Pipelines' }]}
        actions={
          <Button
            variant="primary"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
            onClick={() => {/* trigger modal */ }}
          >
            Trigger Pipeline
          </Button>
        }
      />

      <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/40 px-4 py-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search by service or commit…"
            className="max-w-xs flex-1"
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            options={statusOptions}
            className="w-40"
          />
          <span className="text-xs text-slate-500 ml-auto">{pipelinesTotal} runs</span>
        </div>

        <DataTable
          columns={columns}
          data={pipelines}
          loading={loading}
          keyExtractor={(p) => p.id}
          onRowClick={(p) => navigate(`/cicd/pipelines/${p.id}`)}
          emptyState={
            <EmptyState
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10"><circle cx="12" cy="12" r="3" /><path d="M3 12h6M15 12h6M12 3v6M12 15v6" /></svg>}
              title="No pipelines found"
              description={search ? `No results for "${search}"` : 'Push code or manually trigger a pipeline to get started'}
            />
          }
        />

        {pipelinesTotal > PAGE_SIZE && (
          <div className="border-t border-slate-700/40 px-4">
            <Pagination
              page={page}
              totalPages={Math.ceil(pipelinesTotal / PAGE_SIZE)}
              total={pipelinesTotal}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </CiCdLayout>
  );
}
