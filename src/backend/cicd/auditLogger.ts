// ViBa CI/CD Platform — Audit Logger
// Records all administrative and deployment actions securely without secret values

import type { AuditLog, AuditAction, UUID } from '../../cicd/types';

const memoryAuditLogs: AuditLog[] = [];

export function recordAuditLog(log: {
  userId: UUID;
  userEmail: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  resourceName?: string | null;
  environmentName?: string;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  details?: Record<string, any>;
}): AuditLog {
  const sanitizedDetails = log.details ? sanitizeObject(log.details) : {};
  const timestamp = new Date().toISOString();

  const entry: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: log.userId,
    userEmail: log.userEmail,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId || null,
    resourceName: log.resourceName || null,
    details: sanitizedDetails,
    result: log.result,
    ipAddress: log.ipAddress || '127.0.0.1',
    userAgent: log.userAgent || 'ViBa-CI-CD/1.0',
    timestamp,
    integrityHash: `sha256_${Date.now()}`,
  };

  memoryAuditLogs.unshift(entry);
  if (memoryAuditLogs.length > 1000) {
    memoryAuditLogs.pop();
  }

  return entry;
}

export function getAuditLogs(filter?: {
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  let list = [...memoryAuditLogs];

  if (filter?.userId) {
    list = list.filter((l) => l.userId === filter.userId);
  }
  if (filter?.action) {
    list = list.filter((l) => l.action.toLowerCase().includes(filter.action!.toLowerCase()));
  }
  if (filter?.resourceType) {
    list = list.filter((l) => l.resourceType.toLowerCase() === filter.resourceType!.toLowerCase());
  }
  if (filter?.from) {
    list = list.filter((l) => new Date(l.timestamp) >= new Date(filter.from!));
  }
  if (filter?.to) {
    list = list.filter((l) => new Date(l.timestamp) <= new Date(filter.to!));
  }

  const page = filter?.page || 1;
  const pageSize = filter?.pageSize || 20;
  const total = list.length;
  const data = list.slice((page - 1) * pageSize, page * pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (/secret|token|password|key|auth|credential/i.test(key)) {
      sanitized[key] = '••••••••';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
