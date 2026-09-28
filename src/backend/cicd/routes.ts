// ViBa CI/CD Platform — Express API Router
// Registers all /api/v1/cicd/* and /api/cicd/* endpoints

import { Router } from 'express';
import { CiCdEngine } from './cicdEngine';
import { KubernetesManager } from './k8sManager';
import { getAuditLogs, recordAuditLog } from './auditLogger';

export const cicdRouter = Router();

function sanitizeSecretMetadata(s: any) {
  return {
    ...s,
    value: undefined,
    maskedValue: s.maskedValue || '••••••••',
  };
}

// ─── Platform Stats & Activity ────────────────────────────────────────────────
cicdRouter.get(['/stats', '/v1/cicd/stats'], (req, res) => {
  res.json({ success: true, data: CiCdEngine.getStats() });
});

cicdRouter.get(['/stats/activity', '/v1/cicd/stats/activity'], (req, res) => {
  res.json({ success: true, data: CiCdEngine.getRecentActivity() });
});

// ─── Repositories ─────────────────────────────────────────────────────────────
cicdRouter.get(['/repositories', '/v1/cicd/repositories'], (req, res) => {
  const list = CiCdEngine.getRepositories();
  res.json({
    success: true,
    data: list,
    pagination: { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
  });
});

cicdRouter.post(['/repositories/:id/sync', '/v1/cicd/repositories/:id/sync'], (req, res) => {
  recordAuditLog({
    userId: 'user-admin-01',
    userEmail: 'admin@vibamart.in',
    action: 'service.update',
    resourceType: 'Repository',
    resourceId: req.params.id,
    resourceName: 'vibamart',
    result: 'success',
  });
  res.json({ success: true, data: { synced: true } });
});

// ─── Services ─────────────────────────────────────────────────────────────────
cicdRouter.get(['/services', '/v1/cicd/services'], (req, res) => {
  const services = [
    {
      id: 'srv-vibamart-web',
      name: 'vibamart-web',
      slug: 'vibamart-web',
      description: 'ViBa Mart Core E-Commerce Full-Stack Container Service',
      repositoryId: 'repo-vibamart-main',
      defaultBranch: 'main',
      runtime: 'nodejs',
      dockerfilePath: 'Dockerfile',
      port: 3000,
      ownerId: 'user-admin-01',
      pipelineTemplateId: 'template-viba-default',
      deploymentStrategy: { type: 'rolling', maxSurge: '25%', maxUnavailable: '0%' },
      healthCheck: { type: 'http', path: '/api/health', port: 3000 },
      resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '1000m', memory: '1024Mi' } },
      isActive: true,
      createdBy: 'user-admin-01',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  res.json({
    success: true,
    data: services,
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
});

// ─── Pipelines ────────────────────────────────────────────────────────────────
cicdRouter.get(['/pipelines', '/v1/cicd/pipelines'], (req, res) => {
  const { status, serviceId, branch } = req.query;
  const list = CiCdEngine.getPipelines({
    status: status as string,
    serviceId: serviceId as string,
    branch: branch as string,
  });
  res.json({
    success: true,
    data: list,
    pagination: { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
  });
});

cicdRouter.get(['/pipelines/:id', '/v1/cicd/pipelines/:id'], (req, res) => {
  const pipeline = CiCdEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ success: false, error: { message: `Pipeline ${req.params.id} not found` } });
  }
  res.json({ success: true, data: pipeline });
});

cicdRouter.post(['/pipelines/run', '/v1/cicd/pipelines/run'], async (req, res) => {
  try {
    const { serviceId, branch, commitSha } = req.body;
    const run = await CiCdEngine.triggerPipeline({
      serviceId: serviceId || 'srv-vibamart-web',
      branch: branch || 'main',
      commitSha,
      trigger: 'manual',
    });
    res.json({ success: true, data: run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

cicdRouter.post(['/pipelines/:id/cancel', '/v1/cicd/pipelines/:id/cancel'], (req, res) => {
  const p = CiCdEngine.getPipeline(req.params.id);
  if (p && p.status === 'running') {
    p.status = 'cancelled';
    p.steps.forEach((s) => {
      if (s.status === 'running' || s.status === 'queued') s.status = 'cancelled';
    });
  }
  res.json({ success: true, data: { cancelled: true } });
});

cicdRouter.post(['/pipelines/:id/retry', '/v1/cicd/pipelines/:id/retry'], async (req, res) => {
  const old = CiCdEngine.getPipeline(req.params.id);
  if (!old) {
    return res.status(404).json({ success: false, error: { message: 'Pipeline not found' } });
  }
  const retried = await CiCdEngine.triggerPipeline({
    serviceId: old.serviceId,
    serviceName: old.serviceName,
    branch: old.branch,
    commitSha: old.commitSha,
    commitMessage: `[RETRY] ${old.commitMessage || 'Manual retry'}`,
    author: old.commitAuthor,
    trigger: 'manual',
  });
  res.json({ success: true, data: retried });
});

cicdRouter.get(['/pipelines/:id/steps/:stepId/logs', '/v1/cicd/pipelines/:id/steps/:stepId/logs'], (req, res) => {
  const logs = CiCdEngine.getStepLogs(req.params.id, req.params.stepId);
  res.json({ success: true, data: { logs, streaming: false } });
});

// ─── Builds ───────────────────────────────────────────────────────────────────
cicdRouter.get(['/builds', '/v1/cicd/builds'], (req, res) => {
  const list = CiCdEngine.getBuilds();
  res.json({
    success: true,
    data: list,
    pagination: { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
  });
});

cicdRouter.get(['/builds/:id/logs', '/v1/cicd/builds/:id/logs'], (req, res) => {
  const logs = CiCdEngine.getBuildLogs(req.params.id);
  res.json({ success: true, data: { logs, streaming: false } });
});

// ─── Deployments & Rollback ───────────────────────────────────────────────────
cicdRouter.get(['/deployments', '/v1/cicd/deployments'], (req, res) => {
  const list = CiCdEngine.getDeployments();
  res.json({
    success: true,
    data: list,
    pagination: { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
  });
});

cicdRouter.post(['/deployments/:id/rollback', '/v1/cicd/deployments/:id/rollback', '/rollback'], (req, res) => {
  try {
    const rolledBack = CiCdEngine.rollbackDeployment(req.params.id, req.body.reason);
    res.json({ success: true, data: rolledBack });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ─── Environments ─────────────────────────────────────────────────────────────
cicdRouter.get(['/environments', '/v1/cicd/environments'], (req, res) => {
  res.json({ success: true, data: CiCdEngine.getEnvironments() });
});

// ─── Clusters ─────────────────────────────────────────────────────────────────
cicdRouter.get(['/clusters', '/v1/cicd/clusters', '/kubernetes'], (req, res) => {
  res.json({ success: true, data: KubernetesManager.getClusters() });
});

cicdRouter.get(['/clusters/:id/health', '/v1/cicd/clusters/:id/health'], (req, res) => {
  try {
    const health = KubernetesManager.getClusterHealth(req.params.id);
    res.json({ success: true, data: health });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message } });
  }
});

// ─── Secrets ──────────────────────────────────────────────────────────────────
cicdRouter.get(['/secrets', '/v1/cicd/secrets'], (req, res) => {
  const list = CiCdEngine.getSecrets().map(sanitizeSecretMetadata);
  res.json({
    success: true,
    data: list,
    pagination: { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
  });
});

cicdRouter.post(['/secrets', '/v1/cicd/secrets'], (req, res) => {
  try {
    const created = CiCdEngine.createSecret(req.body);
    res.json({ success: true, data: sanitizeSecretMetadata(created) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
cicdRouter.get(['/audit-logs', '/v1/cicd/audit-logs'], (req, res) => {
  const { page, pageSize, userId, action, resourceType, from, to } = req.query;
  const result = getAuditLogs({
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
    userId: userId as string,
    action: action as string,
    resourceType: resourceType as string,
    from: from as string,
    to: to as string,
  });
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

// ─── Webhook Integration Endpoint ─────────────────────────────────────────────
cicdRouter.post(['/webhooks/github', '/v1/cicd/webhooks/github'], async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'viba_whsec_9876543210fedcba';

  if (process.env.NODE_ENV === 'production') {
    const isValid = CiCdEngine.verifyGitHubWebhook(rawBody, signature, secret);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid GitHub webhook signature' });
    }
  }

  const event = req.headers['x-github-event'] as string;
  const body = req.body;

  if (event === 'push' || event === 'pull_request') {
    const branch = body.ref ? body.ref.replace('refs/heads/', '') : body.pull_request?.head?.ref || 'main';
    const commitSha = body.after || body.head_commit?.id || body.pull_request?.head?.sha;
    const commitMessage = body.head_commit?.message || body.pull_request?.title || 'GitHub Webhook Push Event';
    const author = body.head_commit?.author?.name || body.sender?.login || 'GitHub User';

    const pipelineRun = await CiCdEngine.triggerPipeline({
      serviceId: 'srv-vibamart-web',
      branch,
      commitSha,
      commitMessage,
      author,
      trigger: event === 'push' ? 'push' : 'pull_request',
    });

    return res.json({
      success: true,
      message: `Triggered CI/CD Pipeline ${pipelineRun.id} for branch ${branch}`,
      pipelineId: pipelineRun.id,
    });
  }

  res.json({ success: true, message: `Received GitHub event '${event}' - no action required.` });
});
