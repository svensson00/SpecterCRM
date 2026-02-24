import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { createAuthenticatedAgent, TEST_TENANT_A } from '../helpers/supertest-setup';

const mockPrisma = vi.hoisted(() => ({
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  activityType: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  contactRole: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));

const mockAuditService = vi.hoisted(() => ({
  log: vi.fn(),
  getLogs: vi.fn(),
}));

vi.mock('../../services/audit.service', () => ({
  AuditService: mockAuditService,
}));

describe('Admin Endpoints', () => {
  const tenantId = TEST_TENANT_A;
  const adminUserId = 'admin-1';
  const regularUserId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /admin/settings', () => {
    it('should return tenant settings for authenticated user', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const mockTenant = {
        id: tenantId,
        name: 'Eyevinn Technology',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const res = await agent.get('/api/admin/settings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', tenantId);
      expect(res.body).toHaveProperty('name', 'Eyevinn Technology');
    });
  });

  describe('PATCH /admin/settings', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.patch('/api/admin/settings').send({
        name: 'New Name',
      });

      expect(res.status).toBe(403);
    });

    it('should update tenant settings for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const mockTenant = {
        id: tenantId,
        name: 'Eyevinn Technology AB',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.tenant.findUnique.mockResolvedValue({ id: tenantId, name: 'Eyevinn Technology' });
      mockPrisma.tenant.update.mockResolvedValue(mockTenant);

      const res = await agent.patch('/api/admin/settings').send({
        name: 'Eyevinn Technology AB',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Eyevinn Technology AB');
    });
  });

  describe('GET /admin/activity-types', () => {
    it('should return all activity types for tenant', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const mockActivityTypes = [
        { id: 'type-1', name: 'Workshop', tenantId, isActive: true },
        { id: 'type-2', name: 'POC Demo', tenantId, isActive: true },
        { id: 'type-3', name: 'Architecture Review', tenantId, isActive: true },
      ];

      mockPrisma.activityType.findMany.mockResolvedValue(mockActivityTypes);

      const res = await agent.get('/api/admin/activity-types');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(3);
      expect(res.body[0]).toHaveProperty('name', 'Workshop');
    });
  });

  describe('POST /admin/activity-types', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.post('/api/admin/activity-types').send({
        name: 'Technical Audit',
      });

      expect(res.status).toBe(403);
    });

    it('should create activity type for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const createdType = {
        id: 'type-new',
        name: 'Technical Audit',
        tenantId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.activityType.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.activityType.create.mockResolvedValue(createdType);

      const res = await agent.post('/api/admin/activity-types').send({
        name: 'Technical Audit',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'type-new');
      expect(res.body).toHaveProperty('name', 'Technical Audit');
    });

    it('should return 409 when duplicate name exists', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['name'] },
      });
      mockPrisma.activityType.create.mockRejectedValue(prismaError);

      const res = await agent.post('/api/admin/activity-types').send({
        name: 'Workshop',
      });

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /admin/activity-types/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.patch('/api/admin/activity-types/type-1').send({
        name: 'Updated Workshop',
      });

      expect(res.status).toBe(403);
    });

    it('should update activity type for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const existingType = {
        id: 'type-1',
        name: 'Workshop',
        tenantId,
        isActive: true,
      };

      const updatedType = {
        ...existingType,
        name: 'Advanced Workshop',
      };

      mockPrisma.activityType.findFirst.mockResolvedValue(existingType);
      mockPrisma.activityType.update.mockResolvedValue(updatedType);

      const res = await agent.patch('/api/admin/activity-types/type-1').send({
        name: 'Advanced Workshop',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Advanced Workshop');
    });

    it('should return 404 when activity type not found', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrisma.activityType.update.mockRejectedValue(prismaError);

      const res = await agent.patch('/api/admin/activity-types/nonexistent').send({
        name: 'New Name',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /admin/activity-types/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.delete('/api/admin/activity-types/type-1');

      expect(res.status).toBe(403);
    });

    it('should delete activity type for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const existingType = {
        id: 'type-1',
        name: 'Workshop',
        tenantId,
      };

      mockPrisma.activityType.findFirst.mockResolvedValue(existingType);
      mockPrisma.activityType.delete.mockResolvedValue(existingType);

      const res = await agent.delete('/api/admin/activity-types/type-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 when activity type not found', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrisma.activityType.update.mockRejectedValue(prismaError);

      const res = await agent.delete('/api/admin/activity-types/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should prevent cross-tenant update (issue #20)', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId: 'tenant-A', role: 'ADMIN' });

      // Activity type belongs to tenant-B
      const otherTenantType = {
        id: 'type-other',
        name: 'Workshop',
        tenantId: 'tenant-B',
        isActive: true,
      };

      // findFirst with tenantId filter will return null for other tenant's data
      mockPrisma.activityType.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/admin/activity-types/type-other').send({
        name: 'Hacked Workshop',
      });

      // Should verify tenant ownership and return 404
      expect(mockPrisma.activityType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'type-other',
            tenantId: 'tenant-A',
          }),
        })
      );
      expect(res.status).toBe(404);
    });

    it('should prevent cross-tenant delete (issue #20)', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId: 'tenant-A', role: 'ADMIN' });

      // Activity type belongs to tenant-B
      mockPrisma.activityType.findFirst.mockResolvedValue(null);

      const res = await agent.delete('/api/admin/activity-types/type-other');

      // Should verify tenant ownership and return 404
      expect(mockPrisma.activityType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'type-other',
            tenantId: 'tenant-A',
          }),
        })
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /admin/contact-roles', () => {
    it('should return all contact roles for tenant', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const mockContactRoles = [
        { id: 'role-1', name: 'CTO', tenantId, isActive: true },
        { id: 'role-2', name: 'Head of Streaming', tenantId, isActive: true },
        { id: 'role-3', name: 'Lead Engineer', tenantId, isActive: true },
      ];

      mockPrisma.contactRole.findMany.mockResolvedValue(mockContactRoles);

      const res = await agent.get('/api/admin/contact-roles');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(3);
      expect(res.body[0]).toHaveProperty('name', 'CTO');
    });
  });

  describe('POST /admin/contact-roles', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.post('/api/admin/contact-roles').send({
        name: 'VP Technology',
      });

      expect(res.status).toBe(403);
    });

    it('should create contact role for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const createdRole = {
        id: 'role-new',
        name: 'VP Technology',
        tenantId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.contactRole.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.contactRole.create.mockResolvedValue(createdRole);

      const res = await agent.post('/api/admin/contact-roles').send({
        name: 'VP Technology',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'role-new');
      expect(res.body).toHaveProperty('name', 'VP Technology');
    });

    it('should return 409 when duplicate name exists', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['name'] },
      });
      mockPrisma.contactRole.create.mockRejectedValue(prismaError);

      const res = await agent.post('/api/admin/contact-roles').send({
        name: 'CTO',
      });

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /admin/contact-roles/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.patch('/api/admin/contact-roles/role-1').send({
        name: 'Chief Technology Officer',
      });

      expect(res.status).toBe(403);
    });

    it('should update contact role for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const existingRole = {
        id: 'role-1',
        name: 'CTO',
        tenantId,
        isActive: true,
      };

      const updatedRole = {
        ...existingRole,
        name: 'Chief Technology Officer',
      };

      mockPrisma.contactRole.findFirst.mockResolvedValue(existingRole);
      mockPrisma.contactRole.update.mockResolvedValue(updatedRole);

      const res = await agent.patch('/api/admin/contact-roles/role-1').send({
        name: 'Chief Technology Officer',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Chief Technology Officer');
    });

    it('should return 404 when contact role not found', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrisma.contactRole.update.mockRejectedValue(prismaError);

      const res = await agent.patch('/api/admin/contact-roles/nonexistent').send({
        name: 'New Name',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /admin/contact-roles/:id', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.delete('/api/admin/contact-roles/role-1');

      expect(res.status).toBe(403);
    });

    it('should delete contact role for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const existingRole = {
        id: 'role-1',
        name: 'CTO',
        tenantId,
      };

      mockPrisma.contactRole.findFirst.mockResolvedValue(existingRole);
      mockPrisma.contactRole.delete.mockResolvedValue(existingRole);

      const res = await agent.delete('/api/admin/contact-roles/role-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 when contact role not found', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrisma.contactRole.update.mockRejectedValue(prismaError);

      const res = await agent.delete('/api/admin/contact-roles/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should prevent cross-tenant update (issue #20)', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId: 'tenant-A', role: 'ADMIN' });

      // Contact role belongs to tenant-B
      mockPrisma.contactRole.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/admin/contact-roles/role-other').send({
        name: 'Hacked CTO',
      });

      // Should verify tenant ownership and return 404
      expect(mockPrisma.contactRole.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'role-other',
            tenantId: 'tenant-A',
          }),
        })
      );
      expect(res.status).toBe(404);
    });

    it('should prevent cross-tenant delete (issue #20)', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId: 'tenant-A', role: 'ADMIN' });

      // Contact role belongs to tenant-B
      mockPrisma.contactRole.findFirst.mockResolvedValue(null);

      const res = await agent.delete('/api/admin/contact-roles/role-other');

      // Should verify tenant ownership and return 404
      expect(mockPrisma.contactRole.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'role-other',
            tenantId: 'tenant-A',
          }),
        })
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /admin/audit-logs', () => {
    it('should return 403 for non-admin users', async () => {
      const agent = createAuthenticatedAgent({ userId: regularUserId, tenantId, role: 'USER' });

      const res = await agent.get('/api/admin/audit-logs');

      expect(res.status).toBe(403);
    });

    it('should return paginated audit logs for admin', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      const mockAuditLogs = [
        {
          id: 'log-1',
          tenantId,
          userId: adminUserId,
          entityType: 'ORGANIZATION',
          entityId: 'org-1',
          action: 'CREATE',
          afterData: { name: 'SVT' },
          createdAt: new Date(),
          user: { id: adminUserId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        },
        {
          id: 'log-2',
          tenantId,
          userId: adminUserId,
          entityType: 'DEAL',
          entityId: 'deal-1',
          action: 'UPDATE',
          beforeData: { stage: 'PROSPECT' },
          afterData: { stage: 'QUOTE' },
          createdAt: new Date(),
          user: { id: adminUserId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        },
      ];

      mockAuditService.getLogs.mockResolvedValue({
        data: mockAuditLogs,
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      });

      const res = await agent.get('/api/admin/audit-logs');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('entityType', 'ORGANIZATION');
    });

    it('should support entityType filter', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      mockAuditService.getLogs.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await agent.get('/api/admin/audit-logs?entityType=ORGANIZATION');

      expect(mockAuditService.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'ORGANIZATION',
        })
      );
    });

    it('should support action filter', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      mockAuditService.getLogs.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await agent.get('/api/admin/audit-logs?action=DELETE');

      expect(mockAuditService.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
        })
      );
    });

    it('should support userId filter', async () => {
      const agent = createAuthenticatedAgent({ userId: adminUserId, tenantId, role: 'ADMIN' });

      mockAuditService.getLogs.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await agent.get('/api/admin/audit-logs?userId=user-2');

      expect(mockAuditService.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
        })
      );
    });
  });
});
