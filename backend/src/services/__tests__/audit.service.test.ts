import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));

// Mock logger to prevent console output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { AuditService } from '../audit.service';
import { logger } from '../../utils/logger';

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('should create audit log entry with correct fields', async () => {
      const auditData = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        entityType: 'DEAL',
        entityId: 'deal-789',
        action: 'CREATE',
        beforeData: null,
        afterData: { title: 'Test Deal', stage: 'LEAD' },
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-001',
        ...auditData,
        createdAt: new Date(),
      });

      await AuditService.log(auditData);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-123',
          userId: 'user-456',
          entityType: 'DEAL',
          entityId: 'deal-789',
          action: 'CREATE',
          beforeData: null,
          afterData: { title: 'Test Deal', stage: 'LEAD' },
        },
      });
    });

    it('should convert undefined beforeData and afterData to null', async () => {
      const auditData = {
        tenantId: 'tenant-123',
        entityType: 'ORGANIZATION',
        entityId: 'org-456',
        action: 'DELETE',
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'audit-002',
        ...auditData,
        beforeData: null,
        afterData: null,
        createdAt: new Date(),
      });

      await AuditService.log(auditData);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-123',
          userId: undefined,
          entityType: 'ORGANIZATION',
          entityId: 'org-456',
          action: 'DELETE',
          beforeData: null,
          afterData: null,
        },
      });
    });

    it('should silently catch errors and not throw', async () => {
      const auditData = {
        tenantId: 'tenant-123',
        entityType: 'CONTACT',
        entityId: 'contact-789',
        action: 'UPDATE',
      };

      const dbError = new Error('Database connection failed');
      mockPrisma.auditLog.create.mockRejectedValue(dbError);

      await expect(AuditService.log(auditData)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith('Failed to create audit log:', dbError);
    });
  });

  describe('getLogs', () => {
    it('should return paginated results', async () => {
      const mockLogs = [
        {
          id: 'audit-001',
          tenantId: 'tenant-123',
          userId: 'user-456',
          entityType: 'DEAL',
          entityId: 'deal-789',
          action: 'CREATE',
          beforeData: null,
          afterData: { title: 'Deal 1' },
          createdAt: new Date(),
          user: {
            id: 'user-456',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        {
          id: 'audit-002',
          tenantId: 'tenant-123',
          userId: 'user-456',
          entityType: 'DEAL',
          entityId: 'deal-789',
          action: 'UPDATE',
          beforeData: { stage: 'LEAD' },
          afterData: { stage: 'PROSPECT' },
          createdAt: new Date(),
          user: {
            id: 'user-456',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.auditLog.count.mockResolvedValue(25);

      const result = await AuditService.getLogs({
        tenantId: 'tenant-123',
        page: 2,
        limit: 10,
      });

      expect(result).toEqual({
        data: mockLogs,
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
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
        skip: 10,
        take: 10,
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
      });
    });

    it('should apply entityType filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await AuditService.getLogs({
        tenantId: 'tenant-123',
        entityType: 'ORGANIZATION',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            entityType: 'ORGANIZATION',
          },
        })
      );
    });

    it('should apply entityId filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await AuditService.getLogs({
        tenantId: 'tenant-123',
        entityId: 'deal-789',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            entityId: 'deal-789',
          },
        })
      );
    });

    it('should apply userId filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await AuditService.getLogs({
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            userId: 'user-456',
          },
        })
      );
    });

    it('should apply date range filters', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await AuditService.getLogs({
        tenantId: 'tenant-123',
        startDate,
        endDate,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });

    it('should apply multiple filters together', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await AuditService.getLogs({
        tenantId: 'tenant-123',
        entityType: 'DEAL',
        entityId: 'deal-789',
        userId: 'user-456',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            entityType: 'DEAL',
            entityId: 'deal-789',
            userId: 'user-456',
          },
        })
      );
    });

    it('should use default pagination values', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(100);

      const result = await AuditService.getLogs({
        tenantId: 'tenant-123',
      });

      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 100,
        totalPages: 2,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      );
    });
  });
});
