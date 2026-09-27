// ViBa CI/CD Platform — Zustand Store
// Manages all platform state with typed, scalable slices

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
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
  PaginatedResponse,
  UUID,
} from '../types';

// ─── Slice Interfaces ─────────────────────────────────────────────────────────

interface LoadingState {
  [key: string]: boolean;
}

interface ErrorState {
  [key: string]: string | null;
}

// Services slice
interface ServicesSlice {
  services: Service[];
  servicesTotal: number;
  servicesPage: number;
  servicesLoading: boolean;
  servicesError: string | null;
  selectedService: Service | null;
  setServices: (services: Service[], total?: number) => void;
  setSelectedService: (service: Service | null) => void;
  upsertService: (service: Service) => void;
  removeService: (id: UUID) => void;
}

// Pipelines slice
interface PipelinesSlice {
  pipelines: PipelineRun[];
  pipelinesTotal: number;
  pipelinesLoading: boolean;
  pipelinesError: string | null;
  selectedPipeline: PipelineRun | null;
  activePipelineIds: Set<UUID>; // for real-time tracking
  setSelectedPipeline: (pipeline: PipelineRun | null) => void;
  upsertPipeline: (pipeline: PipelineRun) => void;
  setPipelines: (pipelines: PipelineRun[], total?: number) => void;
  updatePipelineStatus: (id: UUID, updates: Partial<PipelineRun>) => void;
}

// Builds slice
interface BuildsSlice {
  builds: Build[];
  buildsTotal: number;
  buildsLoading: boolean;
  buildsError: string | null;
  selectedBuild: Build | null;
  setBuilds: (builds: Build[], total?: number) => void;
  setSelectedBuild: (build: Build | null) => void;
  upsertBuild: (build: Build) => void;
}

// Deployments slice
interface DeploymentsSlice {
  deployments: Deployment[];
  deploymentsTotal: number;
  deploymentsLoading: boolean;
  deploymentsError: string | null;
  selectedDeployment: Deployment | null;
  setDeployments: (deployments: Deployment[], total?: number) => void;
  setSelectedDeployment: (deployment: Deployment | null) => void;
  upsertDeployment: (deployment: Deployment) => void;
}

// Environments slice
interface EnvironmentsSlice {
  environments: Environment[];
  environmentsLoading: boolean;
  setEnvironments: (environments: Environment[]) => void;
  upsertEnvironment: (env: Environment) => void;
}

// Clusters slice
interface ClustersSlice {
  clusters: Cluster[];
  clustersLoading: boolean;
  setClusters: (clusters: Cluster[]) => void;
  upsertCluster: (cluster: Cluster) => void;
}

// Secrets slice (metadata only, never actual values)
interface SecretsSlice {
  secrets: SecretMetadata[];
  secretsLoading: boolean;
  setSecrets: (secrets: SecretMetadata[]) => void;
  upsertSecret: (secret: SecretMetadata) => void;
  removeSecret: (id: UUID) => void;
}

// Audit logs slice
interface AuditLogsSlice {
  auditLogs: AuditLog[];
  auditLogsTotal: number;
  auditLogsLoading: boolean;
  setAuditLogs: (logs: AuditLog[], total?: number) => void;
}

// Platform stats slice
interface StatsSlice {
  stats: PlatformStats | null;
  statsLoading: boolean;
  recentActivity: RecentActivity[];
  setStats: (stats: PlatformStats) => void;
  setRecentActivity: (activity: RecentActivity[]) => void;
}

// Workers slice
interface WorkersSlice {
  workers: Worker[];
  jobQueue: JobQueueEntry[];
  workersLoading: boolean;
  setWorkers: (workers: Worker[]) => void;
  setJobQueue: (queue: JobQueueEntry[]) => void;
  upsertWorker: (worker: Worker) => void;
}

// Templates slice
interface TemplatesSlice {
  templates: PipelineTemplate[];
  templatesLoading: boolean;
  setTemplates: (templates: PipelineTemplate[]) => void;
  upsertTemplate: (template: PipelineTemplate) => void;
  removeTemplate: (id: UUID) => void;
}

// Repositories slice
interface RepositoriesSlice {
  repositories: Repository[];
  repositoriesLoading: boolean;
  setRepositories: (repos: Repository[]) => void;
  upsertRepository: (repo: Repository) => void;
}

// Artifacts slice
interface ArtifactsSlice {
  artifacts: Artifact[];
  artifactsTotal: number;
  artifactsLoading: boolean;
  setArtifacts: (artifacts: Artifact[], total?: number) => void;
}

// Security slice
interface SecuritySlice {
  scans: SecurityScan[];
  scansLoading: boolean;
  images: ContainerImage[];
  imagesLoading: boolean;
  setScans: (scans: SecurityScan[]) => void;
  setImages: (images: ContainerImage[]) => void;
  upsertScan: (scan: SecurityScan) => void;
}

// Teams slice
interface TeamsSlice {
  teams: Team[];
  teamsLoading: boolean;
  setTeams: (teams: Team[]) => void;
}

// Users (platform users) slice
interface PlatformUsersSlice {
  platformUsers: PlatformUser[];
  platformUsersLoading: boolean;
  setPlatformUsers: (users: PlatformUser[]) => void;
  upsertPlatformUser: (user: PlatformUser) => void;
}

// System Config slice
interface SystemConfigSlice {
  systemConfig: SystemConfig | null;
  systemConfigLoading: boolean;
  setSystemConfig: (config: SystemConfig) => void;
}

// UI state slice
interface UiSlice {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  darkMode: boolean;
  activeTab: string;
  filters: {
    pipelines: PipelineFilters;
    deployments: DeploymentFilters;
  };
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  toggleDarkMode: () => void;
  setActiveTab: (tab: string) => void;
  setPipelineFilters: (filters: Partial<PipelineFilters>) => void;
  setDeploymentFilters: (filters: Partial<DeploymentFilters>) => void;
}

// Loading / error tracking
interface LoadingSlice {
  loading: LoadingState;
  errors: ErrorState;
  setLoading: (key: string, value: boolean) => void;
  setError: (key: string, error: string | null) => void;
  clearError: (key: string) => void;
}

// ─── Combined Store Type ──────────────────────────────────────────────────────

type CiCdStore = ServicesSlice &
  PipelinesSlice &
  BuildsSlice &
  DeploymentsSlice &
  EnvironmentsSlice &
  ClustersSlice &
  SecretsSlice &
  AuditLogsSlice &
  StatsSlice &
  WorkersSlice &
  TemplatesSlice &
  RepositoriesSlice &
  ArtifactsSlice &
  SecuritySlice &
  TeamsSlice &
  PlatformUsersSlice &
  SystemConfigSlice &
  UiSlice &
  LoadingSlice;

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useCiCdStore = create<CiCdStore>()(
  devtools(
    (set, get) => ({
      // ── Services ──
      services: [],
      servicesTotal: 0,
      servicesPage: 1,
      servicesLoading: false,
      servicesError: null,
      selectedService: null,
      setServices: (services, total) =>
        set({ services, servicesTotal: total ?? services.length }),
      setSelectedService: (service) => set({ selectedService: service }),
      upsertService: (service) =>
        set((s) => ({
          services: s.services.some((x) => x.id === service.id)
            ? s.services.map((x) => (x.id === service.id ? service : x))
            : [service, ...s.services],
        })),
      removeService: (id) =>
        set((s) => ({ services: s.services.filter((x) => x.id !== id) })),

      // ── Pipelines ──
      pipelines: [],
      pipelinesTotal: 0,
      pipelinesLoading: false,
      pipelinesError: null,
      selectedPipeline: null,
      activePipelineIds: new Set(),
      setSelectedPipeline: (pipeline) => set({ selectedPipeline: pipeline }),
      upsertPipeline: (pipeline) =>
        set((s) => ({
          pipelines: s.pipelines.some((x) => x.id === pipeline.id)
            ? s.pipelines.map((x) => (x.id === pipeline.id ? pipeline : x))
            : [pipeline, ...s.pipelines],
        })),
      setPipelines: (pipelines, total) =>
        set({ pipelines, pipelinesTotal: total ?? pipelines.length }),
      updatePipelineStatus: (id, updates) =>
        set((s) => ({
          pipelines: s.pipelines.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          selectedPipeline:
            s.selectedPipeline?.id === id
              ? { ...s.selectedPipeline, ...updates }
              : s.selectedPipeline,
        })),

      // ── Builds ──
      builds: [],
      buildsTotal: 0,
      buildsLoading: false,
      buildsError: null,
      selectedBuild: null,
      setBuilds: (builds, total) => set({ builds, buildsTotal: total ?? builds.length }),
      setSelectedBuild: (build) => set({ selectedBuild: build }),
      upsertBuild: (build) =>
        set((s) => ({
          builds: s.builds.some((x) => x.id === build.id)
            ? s.builds.map((x) => (x.id === build.id ? build : x))
            : [build, ...s.builds],
        })),

      // ── Deployments ──
      deployments: [],
      deploymentsTotal: 0,
      deploymentsLoading: false,
      deploymentsError: null,
      selectedDeployment: null,
      setDeployments: (deployments, total) =>
        set({ deployments, deploymentsTotal: total ?? deployments.length }),
      setSelectedDeployment: (deployment) => set({ selectedDeployment: deployment }),
      upsertDeployment: (deployment) =>
        set((s) => ({
          deployments: s.deployments.some((x) => x.id === deployment.id)
            ? s.deployments.map((x) => (x.id === deployment.id ? deployment : x))
            : [deployment, ...s.deployments],
        })),

      // ── Environments ──
      environments: [],
      environmentsLoading: false,
      setEnvironments: (environments) => set({ environments }),
      upsertEnvironment: (env) =>
        set((s) => ({
          environments: s.environments.some((x) => x.id === env.id)
            ? s.environments.map((x) => (x.id === env.id ? env : x))
            : [...s.environments, env],
        })),

      // ── Clusters ──
      clusters: [],
      clustersLoading: false,
      setClusters: (clusters) => set({ clusters }),
      upsertCluster: (cluster) =>
        set((s) => ({
          clusters: s.clusters.some((x) => x.id === cluster.id)
            ? s.clusters.map((x) => (x.id === cluster.id ? cluster : x))
            : [...s.clusters, cluster],
        })),

      // ── Secrets ──
      secrets: [],
      secretsLoading: false,
      setSecrets: (secrets) => set({ secrets }),
      upsertSecret: (secret) =>
        set((s) => ({
          secrets: s.secrets.some((x) => x.id === secret.id)
            ? s.secrets.map((x) => (x.id === secret.id ? secret : x))
            : [secret, ...s.secrets],
        })),
      removeSecret: (id) => set((s) => ({ secrets: s.secrets.filter((x) => x.id !== id) })),

      // ── Audit Logs ──
      auditLogs: [],
      auditLogsTotal: 0,
      auditLogsLoading: false,
      setAuditLogs: (logs, total) =>
        set({ auditLogs: logs, auditLogsTotal: total ?? logs.length }),

      // ── Stats ──
      stats: null,
      statsLoading: false,
      recentActivity: [],
      setStats: (stats) => set({ stats }),
      setRecentActivity: (activity) => set({ recentActivity: activity }),

      // ── Workers ──
      workers: [],
      jobQueue: [],
      workersLoading: false,
      setWorkers: (workers) => set({ workers }),
      setJobQueue: (jobQueue) => set({ jobQueue }),
      upsertWorker: (worker) =>
        set((s) => ({
          workers: s.workers.some((x) => x.id === worker.id)
            ? s.workers.map((x) => (x.id === worker.id ? worker : x))
            : [...s.workers, worker],
        })),

      // ── Templates ──
      templates: [],
      templatesLoading: false,
      setTemplates: (templates) => set({ templates }),
      upsertTemplate: (template) =>
        set((s) => ({
          templates: s.templates.some((x) => x.id === template.id)
            ? s.templates.map((x) => (x.id === template.id ? template : x))
            : [...s.templates, template],
        })),
      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((x) => x.id !== id) })),

      // ── Repositories ──
      repositories: [],
      repositoriesLoading: false,
      setRepositories: (repositories) => set({ repositories }),
      upsertRepository: (repo) =>
        set((s) => ({
          repositories: s.repositories.some((x) => x.id === repo.id)
            ? s.repositories.map((x) => (x.id === repo.id ? repo : x))
            : [...s.repositories, repo],
        })),

      // ── Artifacts ──
      artifacts: [],
      artifactsTotal: 0,
      artifactsLoading: false,
      setArtifacts: (artifacts, total) =>
        set({ artifacts, artifactsTotal: total ?? artifacts.length }),

      // ── Security ──
      scans: [],
      scansLoading: false,
      images: [],
      imagesLoading: false,
      setScans: (scans) => set({ scans }),
      setImages: (images) => set({ images }),
      upsertScan: (scan) =>
        set((s) => ({
          scans: s.scans.some((x) => x.id === scan.id)
            ? s.scans.map((x) => (x.id === scan.id ? scan : x))
            : [scan, ...s.scans],
        })),

      // ── Teams ──
      teams: [],
      teamsLoading: false,
      setTeams: (teams) => set({ teams }),

      // ── Platform Users ──
      platformUsers: [],
      platformUsersLoading: false,
      setPlatformUsers: (users) => set({ platformUsers: users }),
      upsertPlatformUser: (user) =>
        set((s) => ({
          platformUsers: s.platformUsers.some((x) => x.id === user.id)
            ? s.platformUsers.map((x) => (x.id === user.id ? user : x))
            : [...s.platformUsers, user],
        })),

      // ── System Config ──
      systemConfig: null,
      systemConfigLoading: false,
      setSystemConfig: (config) => set({ systemConfig: config }),

      // ── UI ──
      sidebarOpen: true,
      sidebarCollapsed: false,
      darkMode: true, // Developer portal defaults to dark mode
      activeTab: 'dashboard',
      filters: {
        pipelines: { page: 1, pageSize: 20 },
        deployments: { page: 1, pageSize: 20 },
      },
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setPipelineFilters: (filters) =>
        set((s) => ({
          filters: { ...s.filters, pipelines: { ...s.filters.pipelines, ...filters } },
        })),
      setDeploymentFilters: (filters) =>
        set((s) => ({
          filters: { ...s.filters, deployments: { ...s.filters.deployments, ...filters } },
        })),

      // ── Loading / Errors ──
      loading: {},
      errors: {},
      setLoading: (key, value) =>
        set((s) => ({ loading: { ...s.loading, [key]: value } })),
      setError: (key, error) =>
        set((s) => ({ errors: { ...s.errors, [key]: error } })),
      clearError: (key) =>
        set((s) => ({ errors: { ...s.errors, [key]: null } })),
    }),
    { name: 'viba-cicd-store' }
  )
);
