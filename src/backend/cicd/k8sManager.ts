// ViBa CI/CD Platform — Kubernetes Integration Layer
// Handles Kubernetes Cluster status, namespaces, pods, deployments, rolling updates, and rollbacks

import type { Cluster, UUID } from '../../cicd/types';

export interface PodInfo {
  id: string;
  name: string;
  namespace: string;
  status: 'Running' | 'Pending' | 'ContainerCreating' | 'Terminating' | 'Failed' | 'CrashLoopBackOff';
  ready: boolean;
  restarts: number;
  cpuUsage: string;
  memoryUsage: string;
  nodeName: string;
  image: string;
  startedAt: string;
}

const mockClusters: Cluster[] = [
  {
    id: 'cluster-prod-01',
    name: 'viba-k8s-prod-cluster-01',
    slug: 'viba-k8s-prod-cluster-01',
    provider: 'gke',
    region: 'asia-south1-a',
    status: 'healthy',
    version: 'v1.29.3-gke.1000',
    totalNodes: 5,
    readyNodes: 5,
    cpuUsage: 42.5,
    memoryUsage: 58.2,
    environments: ['env-production', 'env-staging'],
    isActive: true,
    addedBy: 'user-admin-01',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cluster-dev-01',
    name: 'viba-k8s-dev-cluster-01',
    slug: 'viba-k8s-dev-cluster-01',
    provider: 'gke',
    region: 'asia-south1-a',
    status: 'healthy',
    version: 'v1.29.3-gke.1000',
    totalNodes: 3,
    readyNodes: 3,
    cpuUsage: 25.1,
    memoryUsage: 35.8,
    environments: ['env-development'],
    isActive: true,
    addedBy: 'user-admin-01',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockPods: Record<string, PodInfo[]> = {
  'vibamart-production': [
    {
      id: 'pod-prod-1',
      name: 'vibamart-web-7d6f5c8b-x92kl',
      namespace: 'vibamart-production',
      status: 'Running',
      ready: true,
      restarts: 0,
      cpuUsage: '45m',
      memoryUsage: '210Mi',
      nodeName: 'gke-prod-node-01',
      image: 'registry.viba.internal/vibamart:a1b2c3d4e5f6',
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'pod-prod-2',
      name: 'vibamart-web-7d6f5c8b-m41qp',
      namespace: 'vibamart-production',
      status: 'Running',
      ready: true,
      restarts: 0,
      cpuUsage: '52m',
      memoryUsage: '225Mi',
      nodeName: 'gke-prod-node-02',
      image: 'registry.viba.internal/vibamart:a1b2c3d4e5f6',
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'vibamart-staging': [
    {
      id: 'pod-stg-1',
      name: 'vibamart-stg-web-6f4a8b-k12lp',
      namespace: 'vibamart-staging',
      status: 'Running',
      ready: true,
      restarts: 0,
      cpuUsage: '20m',
      memoryUsage: '160Mi',
      nodeName: 'gke-prod-node-01',
      image: 'registry.viba.internal/vibamart:b9f8e7d6c5a4',
      startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'vibamart-dev': [
    {
      id: 'pod-dev-1',
      name: 'vibamart-dev-web-5e3d2c-j90mn',
      namespace: 'vibamart-dev',
      status: 'Running',
      ready: true,
      restarts: 1,
      cpuUsage: '15m',
      memoryUsage: '140Mi',
      nodeName: 'gke-dev-node-01',
      image: 'registry.viba.internal/vibamart:c1d2e3f4a5b6',
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

export class KubernetesManager {
  static getClusters(): Cluster[] {
    return mockClusters;
  }

  static getCluster(id: UUID): Cluster | undefined {
    return mockClusters.find((c) => c.id === id);
  }

  static getClusterHealth(id: UUID): Cluster {
    const cluster = mockClusters.find((c) => c.id === id);
    if (!cluster) {
      throw new Error(`Cluster with ID ${id} not found.`);
    }
    cluster.cpuUsage = Math.min(95, Math.max(15, (cluster.cpuUsage || 30) + (Math.random() * 4 - 2)));
    cluster.memoryUsage = Math.min(95, Math.max(20, (cluster.memoryUsage || 40) + (Math.random() * 4 - 2)));
    cluster.updatedAt = new Date().toISOString();
    return cluster;
  }

  static getPodsForNamespace(namespace: string): PodInfo[] {
    return mockPods[namespace] || [];
  }

  static async performRollingUpdate(params: {
    namespace: string;
    deploymentName: string;
    imageTag: string;
    imageDigest?: string;
    replicas: number;
    onProgress?: (log: string) => void;
  }): Promise<{ success: boolean; image: string; message: string }> {
    const { namespace, deploymentName, imageTag, imageDigest, replicas, onProgress } = params;
    const fullImageRef = imageDigest ? `${imageTag}@${imageDigest}` : imageTag;

    onProgress?.(`[K8S] Initiating rolling deployment for ${deploymentName} in namespace ${namespace}`);
    onProgress?.(`[K8S] Target container image: ${fullImageRef}`);
    onProgress?.(`[K8S] Desired replica count: ${replicas}`);
    onProgress?.(`[K8S] Patching Deployment spec.template.spec.containers[0].image = "${fullImageRef}"`);

    const newPods: PodInfo[] = [];
    for (let i = 0; i < replicas; i++) {
      onProgress?.(`[K8S] Creating candidate pod ${deploymentName}-new-${i + 1}...`);
      newPods.push({
        id: `pod-new-${Date.now()}-${i}`,
        name: `${deploymentName}-${imageTag.slice(-7)}-${Math.random().toString(36).slice(2, 7)}`,
        namespace,
        status: 'Running',
        ready: true,
        restarts: 0,
        cpuUsage: '35m',
        memoryUsage: '190Mi',
        nodeName: `gke-node-0${(i % 3) + 1}`,
        image: fullImageRef,
        startedAt: new Date().toISOString(),
      });
    }

    onProgress?.(`[K8S] Executing Liveness Probe & Readiness Probe on new pods...`);
    onProgress?.(`[K8S] HTTP GET http://pod:3000/api/health => 200 OK (Readiness passed)`);
    onProgress?.(`[K8S] Shifting ingress traffic to new replica set (100%)`);
    onProgress?.(`[K8S] Terminating legacy replica set pods gracefully...`);

    mockPods[namespace] = newPods;

    onProgress?.(`[K8S] Rolling update completed successfully for ${deploymentName}`);
    return {
      success: true,
      image: fullImageRef,
      message: `Successfully updated ${deploymentName} to image ${fullImageRef}`,
    };
  }

  static async rollbackDeployment(params: {
    namespace: string;
    deploymentName: string;
    previousImageTag: string;
    onProgress?: (log: string) => void;
  }): Promise<{ success: boolean; image: string; message: string }> {
    const { namespace, deploymentName, previousImageTag, onProgress } = params;

    onProgress?.(`[K8S-ROLLBACK] Emergency rollback triggered for ${deploymentName} in ${namespace}`);
    onProgress?.(`[K8S-ROLLBACK] Reverting Deployment image spec to previous verified release: ${previousImageTag}`);

    return this.performRollingUpdate({
      namespace,
      deploymentName,
      imageTag: previousImageTag,
      replicas: namespace.includes('prod') ? 3 : 1,
      onProgress,
    });
  }
}
