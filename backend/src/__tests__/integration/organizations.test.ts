import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, createAuthenticatedAgent, TEST_TENANT_A } from '../helpers/supertest-setup';

const mockPrisma = vi.hoisted(() => ({
  organization: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  contact: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  deal: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  activity: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  note: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../../services/audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

describe('Organization Endpoints', () => {
  const tenantId = TEST_TENANT_A;
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/organizations', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/organizations');

      expect(res.status).toBe(401);
    });

    it('should return paginated organizations with valid token', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrganizations = [
        {
          id: 'org-1',
          name: 'SVT',
          tenantId,
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          _count: { contacts: 5, deals: 3, activities: 10 },
        },
        {
          id: 'org-2',
          name: 'YLE',
          tenantId,
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          _count: { contacts: 2, deals: 1, activities: 5 },
        },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrganizations);
      mockPrisma.organization.count.mockResolvedValue(2);

      const res = await agent.get('/api/organizations');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('total', 2);
      expect(res.body.pagination).toHaveProperty('totalPages', 1);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('name', 'SVT');
    });

    it('should support pagination parameters', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findMany.mockResolvedValue([]);
      mockPrisma.organization.count.mockResolvedValue(50);

      const res = await agent.get('/api/organizations?page=2&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.pagination).toHaveProperty('page', 2);
      expect(res.body.pagination).toHaveProperty('limit', 10);
      expect(res.body.pagination).toHaveProperty('totalPages', 5);
    });

    it('should support search parameter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findMany.mockResolvedValue([]);
      mockPrisma.organization.count.mockResolvedValue(0);

      await agent.get('/api/organizations?search=SVT');

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        })
      );
    });
  });

  describe('GET /api/organizations/check-duplicates', () => {
    it('should return empty array when no duplicates found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findMany.mockResolvedValue([]);

      const res = await agent.get('/api/organizations/check-duplicates?name=Unique%20Corp');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(0);
    });

    it('should return potential duplicates', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrgs = [
        { id: 'org-1', name: 'Acme Corp', tenantId },
        { id: 'org-2', name: 'ACME Corporation', tenantId },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);

      const res = await agent.get('/api/organizations/check-duplicates?name=Acme%20Corp');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/organizations', () => {
    it('should create organization and return 201', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const orgData = {
        name: 'SVT',
        website: 'https://www.svt.se',
        city: 'Stockholm',
        country: 'Sweden',
      };

      const createdOrg = {
        id: 'org-new',
        ...orgData,
        tenantId,
        createdByUserId: userId,
        ownerUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(null); // No duplicates
      mockPrisma.organization.create.mockResolvedValue(createdOrg);

      const res = await agent.post('/api/organizations').send(orgData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'org-new');
      expect(res.body).toHaveProperty('name', 'SVT');
      expect(res.body).toHaveProperty('website', 'https://www.svt.se');
    });

    it('should return 400 when name is missing', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const res = await agent.post('/api/organizations').send({
        website: 'https://www.example.com',
      });

      expect(res.status).toBe(400);
    });

    it('should return 409 when duplicate name exists', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingOrg = {
        id: 'org-existing',
        name: 'SVT',
        tenantId,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);

      const res = await agent.post('/api/organizations').send({
        name: 'SVT',
      });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/organizations/:id', () => {
    it('should return organization details', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrg = {
        id: 'org-1',
        name: 'SVT',
        website: 'https://www.svt.se',
        tenantId,
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        updatedBy: null,
        _count: { contacts: 5, deals: 3, activities: 10 },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);

      const res = await agent.get('/api/organizations/org-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'org-1');
      expect(res.body).toHaveProperty('name', 'SVT');
    });

    it('should return 404 when organization not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const res = await agent.get('/api/organizations/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/organizations/:id', () => {
    it('should update organization and return updated data', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingOrg = {
        id: 'org-1',
        name: 'SVT',
        website: 'https://www.svt.se',
        tenantId,
        ownerUserId: userId,
      };

      const updatedOrg = {
        ...existingOrg,
        website: 'https://www.svt.se/new',
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.update.mockResolvedValue(updatedOrg);

      const res = await agent.patch('/api/organizations/org-1').send({
        website: 'https://www.svt.se/new',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('website', 'https://www.svt.se/new');
    });

    it('should return 404 when organization not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/organizations/nonexistent').send({
        name: 'New Name',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/organizations/:id', () => {
    it('should delete organization and return 204', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingOrg = {
        id: 'org-1',
        name: 'SVT',
        tenantId,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.delete.mockResolvedValue(existingOrg);

      const res = await agent.delete('/api/organizations/org-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 when organization not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const res = await agent.delete('/api/organizations/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/organizations/:id/contacts', () => {
    it('should return paginated contacts for organization', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrg = { id: 'org-1', name: 'SVT', tenantId };
      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
          tenantId,
          primaryOrganizationId: 'org-1',
          emails: [{ email: 'john@svt.se' }],
          phones: [],
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.contact.count.mockResolvedValue(1);

      const res = await agent.get('/api/organizations/org-1/contacts');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 404 when organization not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const res = await agent.get('/api/organizations/nonexistent/contacts');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/organizations/:id/deals', () => {
    it('should return paginated deals for organization', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrg = { id: 'org-1', name: 'SVT', tenantId };
      const mockDeals = [
        {
          id: 'deal-1',
          title: 'Q1 Streaming Project',
          tenantId,
          organizationId: 'org-1',
          amount: 100000,
          stage: 'PROSPECT',
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.deal.findMany.mockResolvedValue(mockDeals);
      mockPrisma.deal.count.mockResolvedValue(1);

      const res = await agent.get('/api/organizations/org-1/deals');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/organizations/:id/activities', () => {
    it('should return paginated activities for organization', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrg = { id: 'org-1', name: 'SVT', tenantId };
      const mockActivities = [
        {
          id: 'activity-1',
          subject: 'Workshop',
          tenantId,
          relatedOrganizationId: 'org-1',
          isCompleted: false,
          dueAt: new Date(),
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          relatedOrganization: { id: 'org-1', name: 'SVT' },
          relatedDeal: null,
          contacts: [],
          organizations: [],
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities);
      mockPrisma.activity.count.mockResolvedValue(1);

      const res = await agent.get('/api/organizations/org-1/activities');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/organizations/:id/notes', () => {
    it('should return paginated notes for organization', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrg = { id: 'org-1', name: 'SVT', tenantId };
      const mockNotes = [
        {
          id: 'note-1',
          content: 'Important client',
          entityType: 'ORGANIZATION',
          entityId: 'org-1',
          tenantId,
          createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          createdAt: new Date(),
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.note.findMany.mockResolvedValue(mockNotes);
      mockPrisma.note.count.mockResolvedValue(1);

      const res = await agent.get('/api/organizations/org-1/notes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/organizations/:id/notes', () => {
    it('should create note for organization and return 201', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockOrg = { id: 'org-1', name: 'SVT', tenantId };
      const createdNote = {
        id: 'note-new',
        content: 'New note',
        entityType: 'ORGANIZATION',
        entityId: 'org-1',
        tenantId,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.note.create.mockResolvedValue(createdNote);

      const res = await agent.post('/api/organizations/org-1/notes').send({
        content: 'New note',
        entityType: 'ORGANIZATION',
        entityId: 'org-1',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'note-new');
      expect(res.body).toHaveProperty('content', 'New note');
    });

    it('should return 404 when organization not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const res = await agent.post('/api/organizations/nonexistent/notes').send({
        content: 'New note',
        entityType: 'ORGANIZATION',
        entityId: 'nonexistent',
      });

      expect(res.status).toBe(404);
    });
  });
});
