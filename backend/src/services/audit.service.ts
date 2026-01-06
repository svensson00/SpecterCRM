import prisma from '../config/database';
import { logger } from '../utils/logger';

export interface AuditLogData {
  tenantId: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeData?: any;
  afterData?: any;
}

export class AuditService {
  static async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
          beforeData: data.beforeData || null,
          afterData: data.afterData || null,
        },
      });
    } catch (error) {
      logger.error('Failed to create audit log:', error);
    }
  }

  static async getLogs(params: {
    tenantId: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { tenantId, entityType, entityId, userId, startDate, endDate, page = 1, limit = 50 } = params;

    const where: any = { tenantId };

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
