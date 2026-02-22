import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthenticatedAgent, TEST_TENANT_A } from '../helpers/supertest-setup';

const mockPrisma = vi.hoisted(() => ({
  deal: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  organization: {
    findFirst: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
  note: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  activity: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../../services/audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

describe('Deal Endpoints', () => {
  const tenantId = TEST_TENANT_A;
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/deals', () => {
    it('should return paginated deals with valid token', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockDeals = [
        {
          id: 'deal-1',
          title: 'Q1 Streaming Project',
          tenantId,
          organizationId: 'org-1',
          amount: 100000,
          currency: 'SEK',
          stage: 'PROSPECT',
          probability: 50,
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          organization: { id: 'org-1', name: 'SVT' },
        },
      ];

      mockPrisma.deal.findMany.mockResolvedValue(mockDeals);
      mockPrisma.deal.count.mockResolvedValue(1);

      const res = await agent.get('/api/deals');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('title', 'Q1 Streaming Project');
    });

    it('should support stage filter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockPrisma.deal.count.mockResolvedValue(0);

      await agent.get('/api/deals?stage=WON');

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stage: 'WON',
          }),
        })
      );
    });

    it('should support organizationId filter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockPrisma.deal.count.mockResolvedValue(0);

      await agent.get('/api/deals?organizationId=org-1');

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });
  });

  describe('POST /api/deals', () => {
    it('should create deal and return 201', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const dealData = {
        title: 'Q2 Architecture Review',
        organizationId: 'org-1',
        amount: 50000,
        currency: 'SEK',
        stage: 'LEAD',
        probability: 20,
      };

      const mockOrg = { id: 'org-1', name: 'SVT', tenantId };
      const mockTenant = { id: tenantId, currency: 'USD' };
      const createdDeal = {
        id: 'deal-new',
        ...dealData,
        tenantId,
        ownerUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        organization: mockOrg,
        contacts: [],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.deal.create.mockResolvedValue(createdDeal);

      const res = await agent.post('/api/deals').send(dealData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'deal-new');
      expect(res.body).toHaveProperty('title', 'Q2 Architecture Review');
      expect(res.body).toHaveProperty('stage', 'LEAD');
    });

    it('should return 400 when required fields are missing', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const res = await agent.post('/api/deals').send({
        organizationId: 'org-1',
      });

      expect(res.status).toBe(400);
    });

    it('should return 404 when organization not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const res = await agent.post('/api/deals').send({
        title: 'Test Deal',
        organizationId: 'nonexistent',
        amount: 50000,
        stage: 'LEAD',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/deals/:id', () => {
    it('should return deal details', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockDeal = {
        id: 'deal-1',
        title: 'Q1 Streaming Project',
        tenantId,
        organizationId: 'org-1',
        amount: 100000,
        currency: 'SEK',
        stage: 'PROSPECT',
        probability: 50,
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        organization: { id: 'org-1', name: 'SVT' },
        contacts: [],
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        updatedBy: null,
      };

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);

      const res = await agent.get('/api/deals/deal-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'deal-1');
      expect(res.body).toHaveProperty('title', 'Q1 Streaming Project');
    });

    it('should return 404 when deal not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.deal.findFirst.mockResolvedValue(null);

      const res = await agent.get('/api/deals/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/deals/:id', () => {
    it('should update deal and return updated data', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingDeal = {
        id: 'deal-1',
        title: 'Q1 Streaming Project',
        tenantId,
        organizationId: 'org-1',
        amount: 100000,
        stage: 'PROSPECT',
        ownerUserId: userId,
      };

      const updatedDeal = {
        ...existingDeal,
        amount: 150000,
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        organization: { id: 'org-1', name: 'SVT' },
        contacts: [],
      };

      mockPrisma.deal.findFirst.mockResolvedValue(existingDeal);
      mockPrisma.deal.update.mockResolvedValue(updatedDeal);

      const res = await agent.patch('/api/deals/deal-1').send({
        amount: 150000,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('amount', 150000);
    });

    it('should return 404 when deal not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.deal.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/deals/nonexistent').send({
        amount: 150000,
      });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/deals/:id/stage', () => {
    it('should update deal stage to WON', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingDeal = {
        id: 'deal-1',
        title: 'Q1 Streaming Project',
        tenantId,
        stage: 'QUOTE',
        amount: 100000,
        ownerUserId: userId,
      };

      const updatedDeal = {
        ...existingDeal,
        stage: 'WON',
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        organization: { id: 'org-1', name: 'SVT' },
        contacts: [],
      };

      mockPrisma.deal.findFirst.mockResolvedValue(existingDeal);
      mockPrisma.deal.update.mockResolvedValue(updatedDeal);

      const res = await agent.patch('/api/deals/deal-1/stage').send({
        stage: 'WON',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stage', 'WON');
    });

    it('should require reasonLost when stage is LOST', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingDeal = {
        id: 'deal-1',
        title: 'Q1 Streaming Project',
        tenantId,
        stage: 'QUOTE',
        ownerUserId: userId,
      };

      mockPrisma.deal.findFirst.mockResolvedValue(existingDeal);

      const res = await agent.patch('/api/deals/deal-1/stage').send({
        stage: 'LOST',
      });

      expect(res.status).toBe(400);
    });

    it('should allow LOST stage with reasonLost', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingDeal = {
        id: 'deal-1',
        title: 'Q1 Streaming Project',
        tenantId,
        stage: 'QUOTE',
        ownerUserId: userId,
      };

      const updatedDeal = {
        ...existingDeal,
        stage: 'LOST',
        reasonLost: 'Budget constraints',
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        organization: { id: 'org-1', name: 'SVT' },
        contacts: [],
      };

      mockPrisma.deal.findFirst.mockResolvedValue(existingDeal);
      mockPrisma.deal.update.mockResolvedValue(updatedDeal);

      const res = await agent.patch('/api/deals/deal-1/stage').send({
        stage: 'LOST',
        reasonLost: 'Budget constraints',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stage', 'LOST');
      expect(res.body).toHaveProperty('reasonLost', 'Budget constraints');
    });

    it('should return 404 when deal not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.deal.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/deals/nonexistent/stage').send({
        stage: 'WON',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/deals/:id', () => {
    it('should delete deal and return 204', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingDeal = {
        id: 'deal-1',
        title: 'Q1 Streaming Project',
        tenantId,
      };

      mockPrisma.deal.findFirst.mockResolvedValue(existingDeal);
      mockPrisma.deal.delete.mockResolvedValue(existingDeal);

      const res = await agent.delete('/api/deals/deal-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 when deal not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.deal.findFirst.mockResolvedValue(null);

      const res = await agent.delete('/api/deals/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/deals/pipeline/summary', () => {
    it('should return pipeline summary with stage counts', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockPipelineData = [
        { stage: 'LEAD', _count: { _all: 5 }, _sum: { amount: 250000 } },
        { stage: 'PROSPECT', _count: { _all: 3 }, _sum: { amount: 150000 } },
        { stage: 'QUOTE', _count: { _all: 2 }, _sum: { amount: 200000 } },
        { stage: 'WON', _count: { _all: 1 }, _sum: { amount: 100000 } },
        { stage: 'LOST', _count: { _all: 1 }, _sum: { amount: 50000 } },
      ];

      mockPrisma.deal.groupBy.mockResolvedValue(mockPipelineData);

      const res = await agent.get('/api/deals/pipeline/summary');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(5);
      expect(res.body[0]).toHaveProperty('stage');
      expect(res.body[0]).toHaveProperty('count');
      expect(res.body[0]).toHaveProperty('totalAmount');
    });

    it('should support owner filter in pipeline summary', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.deal.groupBy.mockResolvedValue([]);

      await agent.get('/api/deals/pipeline/summary?ownerUserId=user-1');

      expect(mockPrisma.deal.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ownerUserId: 'user-1',
          }),
        })
      );
    });
  });

  describe('GET /api/deals/:id/notes', () => {
    it('should return paginated notes for deal', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockDeal = { id: 'deal-1', title: 'Q1 Project', tenantId };
      const mockNotes = [
        {
          id: 'note-1',
          content: 'Important note',
          entityType: 'DEAL',
          entityId: 'deal-1',
          tenantId,
          createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          createdAt: new Date(),
        },
      ];

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.note.findMany.mockResolvedValue(mockNotes);
      mockPrisma.note.count.mockResolvedValue(1);

      const res = await agent.get('/api/deals/deal-1/notes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/deals/:id/notes', () => {
    it('should create note for deal and return 201', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockDeal = { id: 'deal-1', title: 'Q1 Project', tenantId };
      const createdNote = {
        id: 'note-new',
        content: 'New note',
        entityType: 'DEAL',
        entityId: 'deal-1',
        tenantId,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.note.create.mockResolvedValue(createdNote);

      const res = await agent.post('/api/deals/deal-1/notes').send({
        content: 'New note',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'note-new');
      expect(res.body).toHaveProperty('content', 'New note');
    });
  });

  describe('GET /api/deals/:id/activities', () => {
    it('should return paginated activities for deal', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockDeal = { id: 'deal-1', title: 'Q1 Project', tenantId };
      const mockActivities = [
        {
          id: 'activity-1',
          subject: 'Follow-up call',
          tenantId,
          relatedDealId: 'deal-1',
          isCompleted: false,
          dueAt: new Date(),
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          relatedOrganization: null,
          relatedDeal: { id: 'deal-1', title: 'Q1 Project' },
          contacts: [],
          organizations: [],
        },
      ];

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities);
      mockPrisma.activity.count.mockResolvedValue(1);

      const res = await agent.get('/api/deals/deal-1/activities');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });
  });
});
