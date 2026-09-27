// ViBa Internal Developer Platform — Core Type Definitions
// Production-ready types for CI/CD Platform entities

export type UUID = string;
export type ISO8601 = string;
export type CommitSHA = string;
export type SemVer = string;

// ─── Enumerations ────────────────────────────────────────────────────────────

export type PlatformRole =
  | 'super_admin'
  | 'platform_admin'
  | 'developer'
  | 'devops'
  | 'security'
  | 'viewer';

export type PipelineStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'pending_approval';

export type DeploymentStatus =
  | 'pending'
  | 'running'
  | 'healthy'
  | 'failed'
  | 'rolled_back'
  | 'degraded'
  | 'unknown';

export type EnvironmentType = 'development' | 'staging' | 'production' | 'preview';

export type DeploymentStrategy = 'rolling' | 'blue_green' | 'canary' | 'recreate';

export type RuntimeType =
  | 'nodejs'
  | 'python'
  | 'java'
  | 'go'
  | 'cpp'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'dotnet'
  | 'docker';

export type RepositoryProvider = 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'azure_devops';

export type SecretType = 'env' | 'file' | 'certificate' | 'token' | 'password' | 'api_key';

export type ArtifactType =
  | 'container_image'
  | 'binary'
  | 'archive'
  | 'test_report'
  | 'coverage_report'
  | 'sbom'
  | 'security_report'
  | 'helm_chart';

export type WorkerStatus = 'idle' | 'busy' | 'offline' | 'draining' | 'error';

export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'none';

export type WebhookEvent =
  | 'push'
  | 'pull_request'
  | 'pull_request_merged'
  | 'tag'
  | 'release'
  | 'manual';

export type NotificationChannel = 'web' | 'email' | 'slack' | 'teams' | 'webhook';

export type ClusterProvider = 'gke' | 'eks' | 'aks' | 'k3s' | 'kind' | 'custom';

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: UUID;
  userId: UUID;
  userEmail: string;
  action: AuditAction;
  resourceType: string;
  resourceId: UUID | null;
  resourceName: string | null;
  details: Record<string, unknown>;
  result: 'success' | 'failure';
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: ISO8601;
  // Tamper detection: hash of (userId + action + resourceId + timestamp + secret)
  integrityHash: string;
}

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'service.create'
  | 'service.update'
  | 'service.delete'
  | 'pipeline.trigger'
  | 'pipeline.cancel'
  | 'pipeline.retry'
  | 'build.start'
  | 'build.complete'
  | 'build.fail'
  | 'deployment.create'
  | 'deployment.approve'
  | 'deployment.reject'
  | 'deployment.rollback'
  | 'secret.create'
  | 'secret.update'
  | 'secret.rotate'
  | 'secret.delete'
  | 'permission.change'
  | 'cluster.add'
  | 'environment.create'
  | 'settings.update'
  | 'template.create'
  | 'template.update';

// ─── Repository ───────────────────────────────────────────────────────────────

export interface Repository {
  id: UUID;
  name: string;
  fullName: string; // e.g. "org/repo"
  provider: RepositoryProvider;
  url: string;
  sshUrl?: string;
  defaultBranch: string;
  isPrivate: boolean;
  webhookId?: string;
  webhookSecret?: string; // stored hashed, never returned in API
  lastSyncedAt?: ISO8601;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Pipeline Template ────────────────────────────────────────────────────────

export interface PipelineStep {
  id: string;
  name: string;
  type:
    | 'checkout'
    | 'install'
    | 'lint'
    | 'test'
    | 'build'
    | 'docker_build'
    | 'docker_push'
    | 'security_scan'
    | 'dependency_scan'
    | 'secret_detect'
    | 'image_scan'
    | 'image_sign'
    | 'artifact_publish'
    | 'deploy'
    | 'custom';
  command?: string;
  args?: string[];
  image?: string; // container image for this step
  env?: Record<string, string>;
  secretRefs?: string[]; // secret ids mounted as env
  timeout?: number; // seconds
  retries?: number;
  allowFailure?: boolean;
  condition?: string;
  cache?: CacheConfig;
}

export interface CacheConfig {
  paths: string[];
  key: string; // e.g. "{{ runner.os }}-npm-{{ hashFiles('package-lock.json') }}"
  restoreKeys?: string[];
}

export interface PipelineTemplate {
  id: UUID;
  name: string;
  description: string;
  runtime: RuntimeType;
  version: string;
  steps: PipelineStep[];
  triggers: {
    onPush?: { branches?: string[] };
    onPullRequest?: { branches?: string[] };
    onTag?: { pattern?: string };
    onSchedule?: string; // cron expression
  };
  variables?: Record<string, string>; // default env vars
  createdBy: UUID;
  isDefault: boolean;
  isActive: boolean;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface HealthCheckConfig {
  type: 'http' | 'tcp' | 'command';
  path?: string; // for HTTP
  port?: number;
  command?: string;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  failureThreshold?: number;
  successThreshold?: number;
}

export interface ResourceSpec {
  cpu?: string; // e.g. "500m"
  memory?: string; // e.g. "512Mi"
}

export interface DeploymentStrategyConfig {
  type: DeploymentStrategy;
  maxUnavailable?: number | string;
  maxSurge?: number | string;
  canaryWeight?: number; // 0-100 percentage
  blueGreenSwitch?: 'automatic' | 'manual';
}

export interface Service {
  id: UUID;
  name: string;
  slug: string;
  description: string;
  repositoryId: UUID;
  defaultBranch: string;
  runtime: RuntimeType;
  runtimeVersion?: string;
  dockerfilePath: string; // e.g. "Dockerfile"
  buildCommand?: string;
  testCommand?: string;
  port: number;
  teamId?: UUID;
  ownerId: UUID;
  pipelineTemplateId: UUID;
  deploymentStrategy: DeploymentStrategyConfig;
  clusterId?: UUID;
  namespace?: string;
  environmentId?: UUID;
  healthCheck: HealthCheckConfig;
  resources: {
    requests: ResourceSpec;
    limits: ResourceSpec;
  };
  autoDeployBranch?: string; // branch name that triggers auto-deploy
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  isActive: boolean;
  createdBy: UUID;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Pipeline Run ─────────────────────────────────────────────────────────────

export interface PipelineStepRun {
  id: UUID;
  stepId: string;
  name: string;
  status: PipelineStatus;
  startedAt?: ISO8601;
  finishedAt?: ISO8601;
  durationMs?: number;
  exitCode?: number;
  errorMessage?: string;
  logs?: string; // URL to log storage, not inline for large logs
  logStreamId?: string; // for live streaming
}

export interface PipelineRun {
  id: UUID;
  serviceId: UUID;
  serviceName: string;
  pipelineTemplateId: UUID;
  status: PipelineStatus;
  trigger: WebhookEvent | 'manual';
  branch: string;
  commitSha: CommitSHA;
  commitMessage?: string;
  commitAuthor?: string;
  steps: PipelineStepRun[];
  workerId?: UUID;
  priority: number; // 1-10, higher = more urgent
  startedAt?: ISO8601;
  finishedAt?: ISO8601;
  durationMs?: number;
  queuedAt: ISO8601;
  triggeredBy: UUID; // userId or 'webhook'
  buildId?: UUID;
  artifactIds?: UUID[];
  errorSummary?: string;
  metadata?: Record<string, unknown>;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Build ────────────────────────────────────────────────────────────────────

export interface Build {
  id: UUID;
  pipelineRunId: UUID;
  serviceId: UUID;
  serviceName: string;
  status: PipelineStatus;
  branch: string;
  commitSha: CommitSHA;
  imageTag?: string; // registry/service:sha
  imageDigest?: string;
  artifactIds: UUID[];
  securityScanId?: UUID;
  startedAt?: ISO8601;
  finishedAt?: ISO8601;
  durationMs?: number;
  createdAt: ISO8601;
}

// ─── Container Image ──────────────────────────────────────────────────────────

export interface ContainerImage {
  id: UUID;
  buildId: UUID;
  serviceId: UUID;
  registry: string;
  repository: string;
  tag: string; // commit SHA
  digest: string; // sha256:...
  size?: number; // bytes
  commitSha: CommitSHA;
  vulnerabilityStatus: 'clean' | 'low' | 'medium' | 'high' | 'critical' | 'scanning' | 'error';
  vulnerabilityCount?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  isSigned: boolean;
  provenanceUrl?: string;
  pushedAt: ISO8601;
  createdAt: ISO8601;
}

// ─── Artifact ─────────────────────────────────────────────────────────────────

export interface Artifact {
  id: UUID;
  name: string;
  type: ArtifactType;
  version: string;
  buildId: UUID;
  serviceId: UUID;
  commitSha: CommitSHA;
  storageUrl: string; // signed URL or object storage path
  sizeBytes?: number;
  checksum?: string; // sha256
  contentType?: string;
  retentionDays?: number;
  expiresAt?: ISO8601;
  ownerId: UUID;
  createdAt: ISO8601;
}

// ─── Security Scan ────────────────────────────────────────────────────────────

export interface SecurityFinding {
  id: string;
  severity: ScanSeverity;
  title: string;
  description: string;
  cve?: string;
  cvss?: number;
  package?: string;
  version?: string;
  fixVersion?: string;
  location?: string; // file path
  rule?: string; // for SAST
  suppressed?: boolean;
  suppressedBy?: UUID;
  suppressedReason?: string;
}

export interface SecurityScan {
  id: UUID;
  buildId: UUID;
  serviceId: UUID;
  type: 'sast' | 'dependency' | 'secret_detection' | 'container' | 'iac';
  status: 'running' | 'completed' | 'failed' | 'skipped';
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  policyPassed: boolean;
  blockedBuild: boolean;
  scanner: string; // e.g. "trivy", "semgrep", "gitleaks"
  scannerVersion?: string;
  startedAt: ISO8601;
  finishedAt?: ISO8601;
  createdAt: ISO8601;
}

// ─── Environment ──────────────────────────────────────────────────────────────

export interface Environment {
  id: UUID;
  name: string;
  slug: string;
  type: EnvironmentType;
  clusterId?: UUID;
  namespace?: string;
  description?: string;
  approvalRequired: boolean;
  approvers?: UUID[]; // user ids
  deploymentBranchPolicy?: string; // e.g. "main"
  autoDeployEnabled: boolean;
  protectionRules?: {
    requirePassingChecks: boolean;
    requireSignedCommits: boolean;
    restrictPushers?: UUID[];
  };
  variables?: Record<string, string>; // non-secret env vars
  order: number; // 1=dev, 2=staging, 3=prod
  isActive: boolean;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Cluster ──────────────────────────────────────────────────────────────────

export interface ClusterNode {
  name: string;
  status: 'ready' | 'not_ready' | 'unknown';
  roles: string[];
  age: string;
  version: string;
  cpuCapacity?: string;
  memoryCapacity?: string;
  cpuUsage?: string;
  memoryUsage?: string;
}

export interface Cluster {
  id: UUID;
  name: string;
  slug: string;
  provider: ClusterProvider;
  region?: string;
  endpoint?: string; // masked in UI
  version?: string;
  status: 'healthy' | 'degraded' | 'unreachable' | 'provisioning';
  nodes?: ClusterNode[];
  namespaces?: string[];
  totalNodes?: number;
  readyNodes?: number;
  cpuUsage?: number; // percentage 0-100
  memoryUsage?: number; // percentage 0-100
  environments?: UUID[]; // environment ids linked to this cluster
  isActive: boolean;
  addedBy: UUID;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Deployment ───────────────────────────────────────────────────────────────

export interface DeploymentHealthCheck {
  status: DeploymentStatus;
  message?: string;
  checks?: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; detail?: string }>;
  lastCheckedAt: ISO8601;
}

export interface Deployment {
  id: UUID;
  serviceId: UUID;
  serviceName: string;
  environmentId: UUID;
  environmentName: string;
  clusterId?: UUID;
  clusterName?: string;
  namespace: string;
  version: CommitSHA; // image tag / commit sha
  previousVersion?: CommitSHA;
  imageTag: string;
  status: DeploymentStatus;
  strategy: DeploymentStrategyConfig;
  approvedBy?: UUID;
  approvedAt?: ISO8601;
  startedAt?: ISO8601;
  finishedAt?: ISO8601;
  durationMs?: number;
  health?: DeploymentHealthCheck;
  rollbackAvailable: boolean;
  rolledBackFrom?: UUID; // deployment id that was rolled back
  triggeredBy: UUID;
  pipelineRunId?: UUID;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface DeploymentHistoryEntry {
  id: UUID;
  deploymentId: UUID;
  serviceId: UUID;
  version: CommitSHA;
  status: DeploymentStatus;
  triggeredBy: UUID;
  startedAt?: ISO8601;
  finishedAt?: ISO8601;
  isRollback: boolean;
  notes?: string;
  createdAt: ISO8601;
}

// ─── Secret ───────────────────────────────────────────────────────────────────

export interface SecretMetadata {
  id: UUID;
  name: string;
  key: string; // env var key name, e.g. "DATABASE_URL"
  type: SecretType;
  description?: string;
  environmentId?: UUID;
  environmentName?: string;
  serviceId?: UUID; // null = platform-wide
  isRotationEnabled: boolean;
  lastRotatedAt?: ISO8601;
  expiresAt?: ISO8601;
  version: number;
  isActive: boolean;
  createdBy: UUID;
  updatedBy?: UUID;
  createdAt: ISO8601;
  updatedAt: ISO8601;
  // Value is NEVER stored or returned here - only in Vault/secure backend
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export interface Worker {
  id: UUID;
  name: string;
  status: WorkerStatus;
  currentJobId?: UUID;
  cpuRequest?: string;
  memoryRequest?: string;
  labels?: Record<string, string>;
  lastHeartbeatAt?: ISO8601;
  startedAt?: ISO8601;
  jobsCompleted?: number;
  jobsFailed?: number;
  isEphemeral: boolean;
  nodeId?: string;
  createdAt: ISO8601;
}

export interface JobQueueEntry {
  id: UUID;
  pipelineRunId: UUID;
  serviceId: UUID;
  serviceName: string;
  priority: number;
  status: 'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
  assignedWorkerId?: UUID;
  retryCount: number;
  maxRetries: number;
  timeout: number; // seconds
  queuedAt: ISO8601;
  assignedAt?: ISO8601;
  startedAt?: ISO8601;
  finishedAt?: ISO8601;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  id: UUID;
  repositoryId: UUID;
  serviceId?: UUID;
  event: WebhookEvent;
  provider: RepositoryProvider;
  branch: string;
  commitSha: CommitSHA;
  commitMessage?: string;
  commitAuthor?: string;
  pullRequestId?: string;
  pullRequestTitle?: string;
  rawPayload: Record<string, unknown>;
  signatureValid: boolean;
  processed: boolean;
  pipelineRunId?: UUID;
  receivedAt: ISO8601;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface Team {
  id: UUID;
  name: string;
  slug: string;
  description?: string;
  members: Array<{ userId: UUID; role: PlatformRole }>;
  serviceIds?: UUID[];
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Approval ─────────────────────────────────────────────────────────────────

export interface Approval {
  id: UUID;
  deploymentId: UUID;
  requestedBy: UUID;
  approvers: UUID[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: UUID;
  rejectedBy?: UUID;
  comment?: string;
  expiresAt?: ISO8601;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

// ─── Platform Stats ───────────────────────────────────────────────────────────

export interface PlatformStats {
  totalServices: number;
  activePipelines: number;
  runningBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  activeDeployments: number;
  productionDeployments: number;
  failedDeployments: number;
  deploymentFrequency: number; // deploys per day
  averageBuildTimeMs: number;
  averageDeploymentTimeMs: number;
  buildSuccessRate: number; // 0-100
  queueDepth: number;
  activeWorkers: number;
  updatedAt: ISO8601;
}

export interface RecentActivity {
  id: UUID;
  type: 'pipeline' | 'build' | 'deployment' | 'rollback' | 'security';
  title: string;
  description: string;
  status: PipelineStatus | DeploymentStatus;
  serviceId?: UUID;
  serviceName?: string;
  userId?: UUID;
  timestamp: ISO8601;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: ISO8601;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  requestId: string;
  timestamp: ISO8601;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
  timestamp: ISO8601;
}

// ─── Filter / Query Types ─────────────────────────────────────────────────────

export interface PipelineFilters {
  serviceId?: UUID;
  status?: PipelineStatus;
  branch?: string;
  from?: ISO8601;
  to?: ISO8601;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface DeploymentFilters {
  serviceId?: UUID;
  environmentId?: UUID;
  status?: DeploymentStatus;
  from?: ISO8601;
  to?: ISO8601;
  page?: number;
  pageSize?: number;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface NotificationPreference {
  userId: UUID;
  channels: NotificationChannel[];
  events: {
    buildSuccess: boolean;
    buildFailure: boolean;
    deploySuccess: boolean;
    deployFailure: boolean;
    rollback: boolean;
    approvalRequired: boolean;
    securityFailure: boolean;
  };
  webhookUrl?: string;
  slackWebhookUrl?: string;
}

// ─── System Config ────────────────────────────────────────────────────────────

export interface SystemConfig {
  id: 'global';
  platformName: string;
  registryUrl: string;
  defaultPipelineTemplateId?: UUID;
  maxConcurrentBuilds: number;
  maxWorkers: number;
  defaultBuildTimeoutSecs: number;
  artifactRetentionDays: number;
  auditLogRetentionDays: number;
  securityPolicies: {
    blockOnCritical: boolean;
    blockOnHigh: boolean;
    requireImageSigning: boolean;
    requireDependencyScan: boolean;
    requireSAST: boolean;
    requireSecretDetection: boolean;
  };
  featureFlags: {
    gitopsEnabled: boolean;
    argocdEnabled: boolean;
    tektonEnabled: boolean;
    vaultEnabled: boolean;
    notificationsEnabled: boolean;
  };
  updatedBy: UUID;
  updatedAt: ISO8601;
}

// ─── Cache Stats ──────────────────────────────────────────────────────────────

export interface CacheStats {
  type: 'npm' | 'pnpm' | 'yarn' | 'pip' | 'maven' | 'gradle' | 'go' | 'docker';
  hits: number;
  misses: number;
  hitRate: number; // 0-100
  sizeBytes: number;
  lastCleanedAt?: ISO8601;
}

// ─── Platform User (CI/CD context) ───────────────────────────────────────────

export interface PlatformUser {
  id: UUID;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  platformRole: PlatformRole;
  teamIds?: UUID[];
  notificationPreferences?: NotificationPreference;
  lastLoginAt?: ISO8601;
  isActive: boolean;
  createdAt: ISO8601;
}
