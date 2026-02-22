import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthenticatedAgent, TEST_TENANT_A } from '../helpers/supertest-setup';

const mockPrisma = vi.hoisted(() => ({
  activity: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  activityContact: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  activityOrganization: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  activityType: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../../services/audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

describe('Activity Endpoints', () => {
  const tenantId = TEST_TENANT_A;
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/activities', () => {
    it('should return paginated activities with valid token', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockActivities = [
        {
          id: 'activity-1',
          type: 'Workshop',
          subject: 'Streaming Architecture Workshop',
          description: 'Discuss streaming infrastructure',
          tenantId,
          isCompleted: false,
          dueAt: new Date('2026-03-01'),
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          relatedOrganization: { id: 'org-1', name: 'SVT' },
          relatedDeal: null,
          contacts: [],
          organizations: [],
        },
      ];

      mockPrisma.activity.findMany.mockResolvedValue(mockActivities);
      mockPrisma.activity.count.mockResolvedValue(1);

      const res = await agent.get('/api/activities');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('type', 'Workshop');
    });

    it('should support type filter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.activity.count.mockResolvedValue(0);

      await agent.get('/api/activities?type=Workshop');

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'Workshop',
          }),
        })
      );
    });

    it('should support isCompleted filter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.activity.count.mockResolvedValue(0);

      await agent.get('/api/activities?isCompleted=true');

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isCompleted: true,
          }),
        })
      );
    });

    it('should support date range filter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.activity.count.mockResolvedValue(0);

      await agent.get('/api/activities?startDate=2026-02-01&endDate=2026-02-28');

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should support ownerUserId filter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.activity.count.mockResolvedValue(0);

      await agent.get('/api/activities?ownerUserId=user-2');

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ownerUserId: 'user-2',
          }),
        })
      );
    });
  });

  describe('POST /api/activities', () => {
    it('should create activity and return 201', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const activityData = {
        type: 'Workshop',
        subject: 'Streaming Architecture Workshop',
        description: 'Discuss streaming infrastructure',
        dueAt: '2026-03-01T10:00:00Z',
        relatedOrganizationId: 'org-1',
      };

      const createdActivity = {
        id: 'activity-new',
        type: 'Workshop',
        subject: 'Streaming Architecture Workshop',
        description: 'Discuss streaming infrastructure',
        dueAt: new Date('2026-03-01T10:00:00Z'),
        tenantId,
        ownerUserId: userId,
        relatedOrganizationId: 'org-1',
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        relatedOrganization: { id: 'org-1', name: 'SVT' },
        relatedDeal: null,
        contacts: [],
        organizations: [],
      };

      mockPrisma.activity.create.mockResolvedValue(createdActivity);

      const res = await agent.post('/api/activities').send(activityData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'activity-new');
      expect(res.body).toHaveProperty('type', 'Workshop');
      expect(res.body).toHaveProperty('subject', 'Streaming Architecture Workshop');
    });

    it('should return 400 when required fields are missing', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const res = await agent.post('/api/activities').send({
        type: 'Workshop',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/activities/:id', () => {
    it('should return activity details', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockActivity = {
        id: 'activity-1',
        type: 'Workshop',
        subject: 'Streaming Architecture Workshop',
        description: 'Discuss streaming infrastructure',
        tenantId,
        isCompleted: false,
        dueAt: new Date('2026-03-01'),
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        relatedOrganization: { id: 'org-1', name: 'SVT' },
        relatedDeal: null,
        contacts: [],
        organizations: [],
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        updatedBy: null,
      };

      mockPrisma.activity.findFirst.mockResolvedValue(mockActivity);

      const res = await agent.get('/api/activities/activity-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'activity-1');
      expect(res.body).toHaveProperty('type', 'Workshop');
    });

    it('should return 404 when activity not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findFirst.mockResolvedValue(null);

      const res = await agent.get('/api/activities/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/activities/:id', () => {
    it('should update activity and return updated data', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingActivity = {
        id: 'activity-1',
        type: 'Workshop',
        subject: 'Streaming Architecture Workshop',
        tenantId,
        isCompleted: false,
      };

      const updatedActivity = {
        ...existingActivity,
        subject: 'Advanced Streaming Workshop',
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        relatedOrganization: null,
        relatedDeal: null,
        contacts: [],
        organizations: [],
      };

      mockPrisma.activity.findFirst.mockResolvedValue(existingActivity);
      mockPrisma.activity.update.mockResolvedValue(updatedActivity);

      const res = await agent.patch('/api/activities/activity-1').send({
        subject: 'Advanced Streaming Workshop',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('subject', 'Advanced Streaming Workshop');
    });

    it('should return 404 when activity not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/activities/nonexistent').send({
        subject: 'New Subject',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/activities/:id/complete', () => {
    it('should toggle activity completion status from false to true', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingActivity = {
        id: 'activity-1',
        type: 'Workshop',
        subject: 'Streaming Architecture Workshop',
        tenantId,
        isCompleted: false,
      };

      const updatedActivity = {
        ...existingActivity,
        isCompleted: true,
        completedAt: new Date(),
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        relatedOrganization: null,
        relatedDeal: null,
        contacts: [],
        organizations: [],
      };

      mockPrisma.activity.findFirst.mockResolvedValue(existingActivity);
      mockPrisma.activity.update.mockResolvedValue(updatedActivity);

      const res = await agent.patch('/api/activities/activity-1/complete');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('isCompleted', true);
    });

    it('should toggle activity completion status from true to false', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingActivity = {
        id: 'activity-1',
        type: 'Workshop',
        subject: 'Streaming Architecture Workshop',
        tenantId,
        isCompleted: true,
        completedAt: new Date(),
      };

      const updatedActivity = {
        ...existingActivity,
        isCompleted: false,
        completedAt: null,
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        relatedOrganization: null,
        relatedDeal: null,
        contacts: [],
        organizations: [],
      };

      mockPrisma.activity.findFirst.mockResolvedValue(existingActivity);
      mockPrisma.activity.update.mockResolvedValue(updatedActivity);

      const res = await agent.patch('/api/activities/activity-1/complete');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('isCompleted', false);
    });

    it('should return 404 when activity not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/activities/nonexistent/complete');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/activities/:id', () => {
    it('should delete activity and return 204', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingActivity = {
        id: 'activity-1',
        type: 'Workshop',
        subject: 'Streaming Architecture Workshop',
        tenantId,
      };

      mockPrisma.activity.findFirst.mockResolvedValue(existingActivity);
      mockPrisma.activity.delete.mockResolvedValue(existingActivity);

      const res = await agent.delete('/api/activities/activity-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 when activity not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.activity.findFirst.mockResolvedValue(null);

      const res = await agent.delete('/api/activities/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
