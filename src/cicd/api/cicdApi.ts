// ViBa CI/CD Platform — API Client
// Typed HTTP client for all CI/CD API endpoints with auth, error handling, and request IDs

import type {
  Service,
  PipelineRun,
  Build,
  Deployment,
  Environment,
  Cluster,
  SecretMetadata,
  AuditLog,
  PlatformStats,
  RecentActivity,
  Worker,
  JobQueueEntry,
  PipelineTemplate,
  Repository,
  Artifact,
  SecurityScan,
  ContainerImage,
  Team,
  PlatformUser,
  SystemConfig,
  PipelineFilters,
  DeploymentFilters,
  ApiResponse,
  PaginatedResponse,
  UUID,
  WebhookPayload,
  Approval,
} from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/cicd';

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Request Helper ───────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, any>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': generateRequestId(),
    'X-Platform': 'viba-cicd',
  };

  // Attach Firebase ID token if available
  try {
    const { auth } = await import('../../backend/firebase/firebase');
    const token = await auth.currentUser?.getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No auth context available (e.g., during initialization)
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (!res.ok) {
    let errorData: unknown;
    try {
      errorData = await res.json();
    } catch {
      errorData = { error: { message: res.statusText } };
    }
    const msg = (errorData as any)?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

const get = <T>(path: string, params?: Record<string, any>) =>
  request<T>('GET', path, undefined, params);

const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, body);
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);
const del = <T>(path: string) => request<T>('DELETE', path);

// ─── Platform Stats ───────────────────────────────────────────────────────────

export const statsApi = {
  get: () => get<ApiResponse<PlatformStats>>('/stats'),
  getActivity: (limit?: number) =>
    get<ApiResponse<RecentActivity[]>>('/stats/activity', { limit }),
};

// ─── Services ─────────────────────────────────────────────────────────────────

export const servicesApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; environmentId?: UUID }) =>
    get<PaginatedResponse<Service>>('/services', params),
  get: (id: UUID) => get<ApiResponse<Service>>(`/services/${id}`),
  create: (data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<ApiResponse<Service>>('/services', data),
  update: (id: UUID, data: Partial<Service>) =>
    put<ApiResponse<Service>>(`/services/${id}`, data),
  delete: (id: UUID) => del<ApiResponse<{ deleted: boolean }>>(`/services/${id}`),
  getPipelines: (id: UUID, params?: PipelineFilters) =>
    get<PaginatedResponse<PipelineRun>>(`/services/${id}/pipelines`, params),
  getDeployments: (id: UUID, params?: DeploymentFilters) =>
    get<PaginatedResponse<Deployment>>(`/services/${id}/deployments`, params),
};

// ─── Repositories ─────────────────────────────────────────────────────────────

export const repositoriesApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    get<PaginatedResponse<Repository>>('/repositories', params),
  get: (id: UUID) => get<ApiResponse<Repository>>(`/repositories/${id}`),
  create: (data: Omit<Repository, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<ApiResponse<Repository>>('/repositories', data),
  update: (id: UUID, data: Partial<Repository>) =>
    put<ApiResponse<Repository>>(`/repositories/${id}`, data),
  delete: (id: UUID) => del<ApiResponse<{ deleted: boolean }>>(`/repositories/${id}`),
  sync: (id: UUID) => post<ApiResponse<{ synced: boolean }>>(`/repositories/${id}/sync`),
};

// ─── Pipeline Templates ───────────────────────────────────────────────────────

export const templatesApi = {
  list: () => get<ApiResponse<PipelineTemplate[]>>('/pipeline-templates'),
  get: (id: UUID) => get<ApiResponse<PipelineTemplate>>(`/pipeline-templates/${id}`),
  create: (data: Omit<PipelineTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<ApiResponse<PipelineTemplate>>('/pipeline-templates', data),
  update: (id: UUID, data: Partial<PipelineTemplate>) =>
    put<ApiResponse<PipelineTemplate>>(`/pipeline-templates/${id}`, data),
  delete: (id: UUID) => del<ApiResponse<{ deleted: boolean }>>(`/pipeline-templates/${id}`),
};

// ─── Pipelines ────────────────────────────────────────────────────────────────

export const pipelinesApi = {
  list: (params?: PipelineFilters) =>
    get<PaginatedResponse<PipelineRun>>('/pipelines', params),
  get: (id: UUID) => get<ApiResponse<PipelineRun>>(`/pipelines/${id}`),
  run: (data: { serviceId: UUID; branch: string; commitSha?: string; priority?: number }) =>
    post<ApiResponse<PipelineRun>>('/pipelines/run', data),
  cancel: (id: UUID, reason?: string) =>
    post<ApiResponse<{ cancelled: boolean }>>(`/pipelines/${id}/cancel`, { reason }),
  retry: (id: UUID) =>
    post<ApiResponse<PipelineRun>>(`/pipelines/${id}/retry`),
  getStepLogs: (pipelineId: UUID, stepId: string) =>
    get<ApiResponse<{ logs: string; streaming: boolean }>>(`/pipelines/${pipelineId}/steps/${stepId}/logs`),
};

// ─── Builds ───────────────────────────────────────────────────────────────────

export const buildsApi = {
  list: (params?: { serviceId?: UUID; status?: string; page?: number; pageSize?: number }) =>
    get<PaginatedResponse<Build>>('/builds', params),
  get: (id: UUID) => get<ApiResponse<Build>>(`/builds/${id}`),
  getLogs: (id: UUID) =>
    get<ApiResponse<{ logs: string; streaming: boolean }>>(`/builds/${id}/logs`),
};

// ─── Artifacts ────────────────────────────────────────────────────────────────

export const artifactsApi = {
  list: (params?: { buildId?: UUID; serviceId?: UUID; type?: string; page?: number; pageSize?: number }) =>
    get<PaginatedResponse<Artifact>>('/artifacts', params),
  get: (id: UUID) => get<ApiResponse<Artifact>>(`/artifacts/${id}`),
  download: (id: UUID) =>
    get<ApiResponse<{ url: string; expiresAt: string }>>(`/artifacts/${id}/download`),
  delete: (id: UUID) => del<ApiResponse<{ deleted: boolean }>>(`/artifacts/${id}`),
};

// ─── Container Images ─────────────────────────────────────────────────────────

export const imagesApi = {
  list: (params?: { serviceId?: UUID; page?: number; pageSize?: number }) =>
    get<PaginatedResponse<ContainerImage>>('/images', params),
  get: (id: UUID) => get<ApiResponse<ContainerImage>>(`/images/${id}`),
  scan: (id: UUID) =>
    post<ApiResponse<{ scanId: UUID }>>(`/images/${id}/scan`),
};

// ─── Security Scans ───────────────────────────────────────────────────────────

export const securityApi = {
  list: (params?: { buildId?: UUID; serviceId?: UUID; type?: string }) =>
    get<PaginatedResponse<SecurityScan>>('/security/scans', params),
  get: (id: UUID) => get<ApiResponse<SecurityScan>>(`/security/scans/${id}`),
  suppress: (scanId: UUID, findingId: string, reason: string) =>
    post<ApiResponse<{ suppressed: boolean }>>(`/security/scans/${scanId}/findings/${findingId}/suppress`, { reason }),
};

// ─── Deployments ──────────────────────────────────────────────────────────────

export const deploymentsApi = {
  list: (params?: DeploymentFilters) =>
    get<PaginatedResponse<Deployment>>('/deployments', params),
  get: (id: UUID) => get<ApiResponse<Deployment>>(`/deployments/${id}`),
  create: (data: {
    serviceId: UUID;
    environmentId: UUID;
    imageTag: string;
    strategy?: Partial<Deployment['strategy']>;
  }) => post<ApiResponse<Deployment>>('/deployments', data),
  rollback: (id: UUID, targetVersion?: string, reason?: string) =>
    post<ApiResponse<Deployment>>(`/deployments/${id}/rollback`, { targetVersion, reason }),
  approve: (id: UUID, comment?: string) =>
    post<ApiResponse<Approval>>(`/deployments/${id}/approve`, { comment }),
  reject: (id: UUID, comment?: string) =>
    post<ApiResponse<Approval>>(`/deployments/${id}/reject`, { comment }),
  getHistory: (id: UUID) =>
    get<ApiResponse<Deployment[]>>(`/deployments/${id}/history`),
};

// ─── Environments ─────────────────────────────────────────────────────────────

export const environmentsApi = {
  list: () => get<ApiResponse<Environment[]>>('/environments'),
  get: (id: UUID) => get<ApiResponse<Environment>>(`/environments/${id}`),
  create: (data: Omit<Environment, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<ApiResponse<Environment>>('/environments', data),
  update: (id: UUID, data: Partial<Environment>) =>
    put<ApiResponse<Environment>>(`/environments/${id}`, data),
  delete: (id: UUID) => del<ApiResponse<{ deleted: boolean }>>(`/environments/${id}`),
};

// ─── Clusters ─────────────────────────────────────────────────────────────────

export const clustersApi = {
  list: () => get<ApiResponse<Cluster[]>>('/clusters'),
  get: (id: UUID) => get<ApiResponse<Cluster>>(`/clusters/${id}`),
  add: (data: Omit<Cluster, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<ApiResponse<Cluster>>('/clusters', data),
  update: (id: UUID, data: Partial<Cluster>) =>
    put<ApiResponse<Cluster>>(`/clusters/${id}`, data),
  remove: (id: UUID) => del<ApiResponse<{ removed: boolean }>>(`/clusters/${id}`),
  health: (id: UUID) => get<ApiResponse<Cluster>>(`/clusters/${id}/health`),
};

// ─── Secrets (metadata only) ──────────────────────────────────────────────────

export const secretsApi = {
  list: (params?: { environmentId?: UUID; serviceId?: UUID; page?: number; pageSize?: number }) =>
    get<PaginatedResponse<SecretMetadata>>('/secrets', params),
  get: (id: UUID) => get<ApiResponse<SecretMetadata>>(`/secrets/${id}`),
  create: (data: {
    name: string;
    key: string;
    type: SecretMetadata['type'];
    value: string; // value is sent but never stored in frontend state
    description?: string;
    environmentId?: UUID;
    serviceId?: UUID;
  }) => post<ApiResponse<SecretMetadata>>('/secrets', data),
  update: (id: UUID, data: { value?: string; description?: string; isRotationEnabled?: boolean }) =>
    put<ApiResponse<SecretMetadata>>(`/secrets/${id}`, data),
  rotate: (id: UUID, newValue: string) =>
    post<ApiResponse<SecretMetadata>>(`/secrets/${id}/rotate`, { value: newValue }),
  disable: (id: UUID) =>
    patch<ApiResponse<SecretMetadata>>(`/secrets/${id}/disable`),
  delete: (id: UUID) => del<ApiResponse<{ deleted: boolean }>>(`/secrets/${id}`),
};

// ─── Workers ──────────────────────────────────────────────────────────────────

export const workersApi = {
  list: () => get<ApiResponse<Worker[]>>('/workers'),
  queue: () => get<ApiResponse<JobQueueEntry[]>>('/workers/queue'),
  cancelJob: (jobId: UUID) =>
    post<ApiResponse<{ cancelled: boolean }>>(`/workers/jobs/${jobId}/cancel`),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditApi = {
  list: (params?: {
    userId?: UUID;
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) => get<PaginatedResponse<AuditLog>>('/audit-logs', params),
  export: (params?: { from?: string; to?: string }) =>
    get<ApiResponse<{ url: string }>>('/audit-logs/export', params),
};

// ─── Teams ────────────────────────────────────────────────────────────────────

export const teamsApi = {
  list: () => get<ApiResponse<Team[]>>('/teams'),
  get: (id: UUID) => get<ApiResponse<Team>>(`/teams/${id}`),
  create: (data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<ApiResponse<Team>>('/teams', data),
  update: (id: UUID, data: Partial<Team>) =>
    put<ApiResponse<Team>>(`/teams/${id}`, data),
  delete: (id: UUID) => del<ApiResponse<{ deleted: boolean }>>(`/teams/${id}`),
};

// ─── Platform Users ───────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    get<PaginatedResponse<PlatformUser>>('/users', params),
  get: (id: UUID) => get<ApiResponse<PlatformUser>>(`/users/${id}`),
  updateRole: (id: UUID, platformRole: string) =>
    patch<ApiResponse<PlatformUser>>(`/users/${id}/role`, { platformRole }),
  deactivate: (id: UUID) => patch<ApiResponse<PlatformUser>>(`/users/${id}/deactivate`),
};

// ─── System Config ────────────────────────────────────────────────────────────

export const configApi = {
  get: () => get<ApiResponse<SystemConfig>>('/config'),
  update: (data: Partial<SystemConfig>) =>
    put<ApiResponse<SystemConfig>>('/config', data),
};

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export const webhooksApi = {
  list: (params?: { repositoryId?: UUID; page?: number }) =>
    get<PaginatedResponse<WebhookPayload>>('/webhooks', params),
  createSecret: (repositoryId: UUID) =>
    post<ApiResponse<{ secret: string }>>('/webhooks/secret', { repositoryId }),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  getPreferences: () =>
    get<ApiResponse<import('../types').NotificationPreference>>('/notifications/preferences'),
  updatePreferences: (data: Partial<import('../types').NotificationPreference>) =>
    put<ApiResponse<import('../types').NotificationPreference>>('/notifications/preferences', data),
};

// ─── Composite helpers ────────────────────────────────────────────────────────

/**
 * Load all initial data for the platform dashboard.
 * Called once on portal mount.
 */
export async function loadPlatformBootstrap() {
  const [statsRes, activityRes, envsRes, clustersRes, templatesRes] = await Promise.allSettled([
    statsApi.get(),
    statsApi.getActivity(20),
    environmentsApi.list(),
    clustersApi.list(),
    templatesApi.list(),
  ]);

  return {
    stats: statsRes.status === 'fulfilled' ? statsRes.value.data : null,
    activity: activityRes.status === 'fulfilled' ? activityRes.value.data : [],
    environments: envsRes.status === 'fulfilled' ? envsRes.value.data : [],
    clusters: clustersRes.status === 'fulfilled' ? clustersRes.value.data : [],
    templates: templatesRes.status === 'fulfilled' ? templatesRes.value.data : [],
  };
}

export default {
  stats: statsApi,
  services: servicesApi,
  repositories: repositoriesApi,
  templates: templatesApi,
  pipelines: pipelinesApi,
  builds: buildsApi,
  artifacts: artifactsApi,
  images: imagesApi,
  security: securityApi,
  deployments: deploymentsApi,
  environments: environmentsApi,
  clusters: clustersApi,
  secrets: secretsApi,
  workers: workersApi,
  audit: auditApi,
  teams: teamsApi,
  users: usersApi,
  config: configApi,
  webhooks: webhooksApi,
  notifications: notificationsApi,
};
