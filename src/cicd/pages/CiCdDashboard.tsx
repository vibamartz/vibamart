// ViBa CI/CD Platform — Dashboard Page
// Real-time overview of the entire platform health and activity

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CiCdLayout } from '../components/CiCdLayout';
import {
  StatCard, StatusBadge, PageHeader, Skeleton, EmptyState, Button,
  formatDuration, relativeTime, ShortSha,
} from '../components/shared';
import { useCiCdStore } from '../store/cicdStore';
import { statsApi, pipelinesApi, deploymentsApi } from '../api/cicdApi';
import type { PipelineRun, Deployment, RecentActivity } from '../types';

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, color = '#6366f1', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 120;
  const H = height;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Activity Item ────────────────────────────────────────────────────────────

function ActivityItem({ item }: { item: RecentActivity; key?: React.Key }) {
  const typeColors: Record<string, string> = {
    pipeline:   'bg-blue-500/20 text-blue-400',
    build:      'bg-purple-500/20 text-purple-400',
    deployment: 'bg-emerald-500/20 text-emerald-400',
    rollback:   'bg-amber-500/20 text-amber-400',
    security:   'bg-red-500/20 text-red-400',
  };
  const typeIcons: Record<string, string> = {
    pipeline:   '⚡',
    build:      '🔨',
    deployment: '🚀',
    rollback:   '↩',
    security:   '🛡',
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-700/30 last:border-0">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm ${typeColors[item.type] ?? 'bg-slate-700/40 text-slate-400'}`}>
        {typeIcons[item.type] ?? '●'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
        <p className="text-xs text-slate-500 truncate">{item.description}</p>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <StatusBadge status={item.status} size="sm" />
        <span className="text-[10px] text-slate-500">{relativeTime(item.timestamp)}</span>
      </div>
    </div>
  );
}

// ─── Live Pipeline Card ───────────────────────────────────────────────────────

function LivePipelineCard({ pipeline }: { pipeline: PipelineRun; key?: React.Key }) {
  const navigate = useNavigate();
  const completedSteps = pipeline.steps.filter((s) => s.status === 'passed' || s.status === 'failed').length;
  const progress = pipeline.steps.length > 0 ? (completedSteps / pipeline.steps.length) * 100 : 0;

  return (
    <div
      className="cursor-pointer rounded-xl border border-slate-700/40 bg-[#1a1d27] p-4 hover:border-indigo-500/40 hover:bg-[#1e2130] transition-all"
      onClick={() => navigate(`/cicd/pipelines/${pipeline.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{pipeline.serviceName}</p>
          <p className="text-xs text-slate-400 truncate">{pipeline.branch}</p>
        </div>
        <StatusBadge status={pipeline.status} pulse={pipeline.status === 'running'} />
      </div>
      {pipeline.status === 'running' && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{completedSteps}/{pipeline.steps.length} steps</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700/60">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <ShortSha sha={pipeline.commitSha} />
        <span>{relativeTime(pipeline.queuedAt)}</span>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function CiCdDashboard() {
  const navigate = useNavigate();
  const { stats, recentActivity, pipelines, deployments, setStats, setRecentActivity, setPipelines, setDeployments } = useCiCdStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Simulated sparkline data (in production, fetched from time-series API)
  const buildSparkline = [12, 8, 15, 10, 20, 14, 18, 22, 16, 24, 19, 28];
  const deploySparkline = [3, 5, 4, 7, 6, 9, 8, 12, 10, 14, 11, 16];

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, activityRes, pipelinesRes, deploymentsRes] = await Promise.allSettled([
        statsApi.get(),
        statsApi.getActivity(15),
        pipelinesApi.list({ page: 1, pageSize: 8 }),
        deploymentsApi.list({ page: 1, pageSize: 6 }),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (activityRes.status === 'fulfilled') setRecentActivity(activityRes.value.data);
      if (pipelinesRes.status === 'fulfilled') setPipelines(pipelinesRes.value.data, pipelinesRes.value.pagination.total);
      if (deploymentsRes.status === 'fulfilled') setDeployments(deploymentsRes.value.data, deploymentsRes.value.pagination.total);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setStats, setRecentActivity, setPipelines, setDeployments]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30s
    const interval = setInterval(() => loadData(true), 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activePipelines = pipelines.filter((p) => p.status === 'running' || p.status === 'queued');

  return (
    <CiCdLayout title="Dashboard">
      <PageHeader
        title="Platform Overview"
        description="Real-time view of your CI/CD pipeline health and activity"
        actions={
          <Button
            variant="ghost"
            size="sm"
            loading={refreshing}
            onClick={() => loadData(true)}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            }
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard
          label="Total Services"
          value={loading ? '—' : stats?.totalServices ?? 0}
          color="blue"
          loading={loading}
          onClick={() => navigate('/cicd/services')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
            </svg>
          }
        />
        <StatCard
          label="Running Builds"
          value={loading ? '—' : stats?.runningBuilds ?? 0}
          color="purple"
          loading={loading}
          onClick={() => navigate('/cicd/builds')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <circle cx="12" cy="12" r="3" /><path d="M3 12h6M15 12h6M12 3v6M12 15v6" />
            </svg>
          }
        />
        <StatCard
          label="Successful Builds"
          value={loading ? '—' : stats?.successfulBuilds ?? 0}
          color="green"
          loading={loading}
          trend={stats ? { value: 8, label: 'vs last week' } : undefined}
          onClick={() => navigate('/cicd/builds')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
        <StatCard
          label="Failed Builds"
          value={loading ? '—' : stats?.failedBuilds ?? 0}
          color="red"
          loading={loading}
          onClick={() => navigate('/cicd/builds?status=failed')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard
          label="Active Deployments"
          value={loading ? '—' : stats?.activeDeployments ?? 0}
          color="green"
          loading={loading}
          onClick={() => navigate('/cicd/deployments')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
        />
        <StatCard
          label="Production Deploys"
          value={loading ? '—' : stats?.productionDeployments ?? 0}
          color="amber"
          loading={loading}
          onClick={() => navigate('/cicd/deployments?environment=production')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
        />
        <StatCard
          label="Avg Build Time"
          value={loading ? '—' : formatDuration(stats?.averageBuildTimeMs)}
          color="slate"
          loading={loading}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <StatCard
          label="Build Success Rate"
          value={loading ? '—' : `${stats?.buildSuccessRate?.toFixed(1) ?? 0}%`}
          color={!stats || stats.buildSuccessRate >= 90 ? 'green' : stats.buildSuccessRate >= 70 ? 'amber' : 'red'}
          loading={loading}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            </svg>
          }
        />
      </div>

      {/* ── Trend Charts + Live Pipelines ── */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">

        {/* Build Trend */}
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Build Volume</p>
            <p className="text-xs text-slate-400">Last 12 hours</p>
          </div>
          <Sparkline data={buildSparkline} color="#6366f1" height={60} />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>12h ago</span>
            <span className="text-indigo-400 font-semibold">{buildSparkline[buildSparkline.length - 1]} builds/hr</span>
            <span>now</span>
          </div>
        </div>

        {/* Deploy Trend */}
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Deployment Frequency</p>
            <p className="text-xs text-slate-400">
              {loading ? '—' : `${stats?.deploymentFrequency?.toFixed(1) ?? 0} deploys/day`}
            </p>
          </div>
          <Sparkline data={deploySparkline} color="#22c55e" height={60} />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>12h ago</span>
            <span className="text-emerald-400 font-semibold">{deploySparkline[deploySparkline.length - 1]} deploys/hr</span>
            <span>now</span>
          </div>
        </div>

        {/* Queue Status */}
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Queue Status</p>
              <p className="text-xs text-slate-400">Worker utilization</p>
            </div>
            {loading ? <Skeleton className="h-5 w-12" /> : (
              <span className="text-2xl font-bold text-white">{stats?.queueDepth ?? 0}</span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Active Workers</span>
                <span className="text-white font-medium">{loading ? '—' : `${stats?.activeWorkers ?? 0}`}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${stats ? Math.min((stats.activeWorkers / 20) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Queue Depth</span>
                <span className="text-white font-medium">{loading ? '—' : stats?.queueDepth ?? 0}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${stats ? Math.min((stats.queueDepth / 50) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Pipelines + Recent Activity + Deployments ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Active Pipelines */}
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
            <div>
              <p className="text-sm font-semibold text-white">Active Pipelines</p>
              <p className="text-xs text-slate-400">{activePipelines.length} in progress</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/cicd/pipelines')}>
              View all →
            </Button>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))
            ) : activePipelines.length === 0 ? (
              <EmptyState
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                    <circle cx="12" cy="12" r="3" /><path d="M3 12h6M15 12h6" />
                  </svg>
                }
                title="No active pipelines"
                description="All pipelines are idle"
              />
            ) : (
              activePipelines.slice(0, 4).map((p) => (
                <LivePipelineCard key={p.id} pipeline={p} />
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
            <p className="text-sm font-semibold text-white">Recent Activity</p>
            <Button variant="ghost" size="sm" onClick={() => navigate('/cicd/audit')}>
              Audit log →
            </Button>
          </div>
          <div className="px-5 py-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-slate-700/30">
                  <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))
            ) : recentActivity.length === 0 ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
                title="No recent activity"
              />
            ) : (
              recentActivity.slice(0, 8).map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))
            )}
          </div>
        </div>

        {/* Recent Deployments */}
        <div className="rounded-xl border border-slate-700/40 bg-[#1a1d27] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
            <p className="text-sm font-semibold text-white">Recent Deployments</p>
            <Button variant="ghost" size="sm" onClick={() => navigate('/cicd/deployments')}>
              View all →
            </Button>
          </div>
          <div className="divide-y divide-slate-700/30">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-5 py-3">
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))
            ) : deployments.length === 0 ? (
              <div className="px-5">
                <EmptyState
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>}
                  title="No deployments yet"
                />
              </div>
            ) : (
              deployments.slice(0, 6).map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
                  onClick={() => navigate(`/cicd/deployments/${dep.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{dep.serviceName}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        dep.environmentName?.toLowerCase() === 'production'
                          ? 'bg-red-500/15 text-red-300'
                          : dep.environmentName?.toLowerCase() === 'staging'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-blue-500/15 text-blue-300'
                      }`}>
                        {dep.environmentName}
                      </span>
                      <ShortSha sha={dep.version} />
                    </div>
                  </div>
                  <StatusBadge status={dep.status} size="sm" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </CiCdLayout>
  );
}
