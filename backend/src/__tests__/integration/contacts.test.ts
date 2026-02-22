import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthenticatedAgent, TEST_TENANT_A } from '../helpers/supertest-setup';

const mockPrisma = vi.hoisted(() => ({
  contact: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  contactEmail: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  contactPhone: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  organization: {
    findFirst: vi.fn(),
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
  $transaction: vi.fn((callback) => callback(mockPrisma)),
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../../services/audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

describe('Contact Endpoints', () => {
  const tenantId = TEST_TENANT_A;
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/contacts', () => {
    it('should return paginated contacts with valid token', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
          jobTitle: 'CTO',
          tenantId,
          primaryOrganizationId: 'org-1',
          emails: [{ email: 'john@svt.se' }],
          phones: [{ phone: '+46701234567' }],
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          primaryOrganization: { id: 'org-1', name: 'SVT' },
        },
      ];

      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.contact.count.mockResolvedValue(1);

      const res = await agent.get('/api/contacts');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('firstName', 'John');
    });

    it('should support multi-word search', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.contact.count.mockResolvedValue(0);

      await agent.get('/api/contacts?search=John%20Doe');

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should support organizationId filter', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.contact.count.mockResolvedValue(0);

      await agent.get('/api/contacts?organizationId=org-1');

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            primaryOrganizationId: 'org-1',
          }),
        })
      );
    });
  });

  describe('GET /api/contacts/check-duplicates', () => {
    it('should return potential duplicates based on email', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
          tenantId,
          emails: [{ email: 'john@svt.se', isPrimary: true }],
          primaryOrganization: { id: 'org-1', name: 'SVT' },
          similarityScore: 1.0,
          matchReason: 'email',
        },
      ];

      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);

      const res = await agent.get('/api/contacts/check-duplicates?firstName=John&lastName=Doe&emails=john@svt.se&primaryOrganizationId=org-1');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
    });

    it('should return empty array when no duplicates found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.contact.findMany.mockResolvedValue([]);

      const res = await agent.get('/api/contacts/check-duplicates?firstName=Jane&lastName=Smith&emails=unique@example.com&primaryOrganizationId=org-1');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/contacts', () => {
    it('should create contact with emails and phones and return 201', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const contactData = {
        firstName: 'Jane',
        lastName: 'Smith',
        jobTitle: 'Head of Streaming',
        primaryOrganizationId: 'org-1',
        emails: [{ email: 'jane@svt.se', isPrimary: true }],
        phones: [{ phone: '+46701234567', isPrimary: true }],
      };

      const mockOrg = { id: 'org-1', name: 'SVT', tenantId };
      const createdContact = {
        id: 'contact-new',
        firstName: 'Jane',
        lastName: 'Smith',
        jobTitle: 'Head of Streaming',
        tenantId,
        primaryOrganizationId: 'org-1',
        ownerUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        emails: [{ id: 'email-1', contactId: 'contact-new', email: 'jane@svt.se' }],
        phones: [{ id: 'phone-1', contactId: 'contact-new', phone: '+46701234567' }],
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        primaryOrganization: mockOrg,
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.contact.create.mockResolvedValue(createdContact);

      const res = await agent.post('/api/contacts').send(contactData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'contact-new');
      expect(res.body).toHaveProperty('firstName', 'Jane');
      expect(res.body.emails).toHaveLength(1);
      expect(res.body.phones).toHaveLength(1);
    });

    it('should return 400 when required fields are missing', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const res = await agent.post('/api/contacts').send({
        firstName: 'Jane',
      });

      expect(res.status).toBe(400);
    });

    it('should return 404 when organization not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const res = await agent.post('/api/contacts').send({
        firstName: 'Jane',
        lastName: 'Smith',
        primaryOrganizationId: 'nonexistent',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/contacts/:id', () => {
    it('should return contact details', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockContact = {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        jobTitle: 'CTO',
        tenantId,
        primaryOrganizationId: 'org-1',
        emails: [{ email: 'john@svt.se' }],
        phones: [{ phone: '+46701234567' }],
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        primaryOrganization: { id: 'org-1', name: 'SVT' },
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        updatedBy: null,
      };

      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);

      const res = await agent.get('/api/contacts/contact-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'contact-1');
      expect(res.body).toHaveProperty('firstName', 'John');
    });

    it('should return 404 when contact not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.contact.findFirst.mockResolvedValue(null);

      const res = await agent.get('/api/contacts/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/contacts/:id', () => {
    it('should update contact and return updated data', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingContact = {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        jobTitle: 'CTO',
        tenantId,
        primaryOrganizationId: 'org-1',
      };

      const updatedContact = {
        ...existingContact,
        jobTitle: 'Chief Technology Officer',
        emails: [],
        phones: [],
        owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
        primaryOrganization: { id: 'org-1', name: 'SVT' },
      };

      mockPrisma.contact.findFirst.mockResolvedValue(existingContact);
      mockPrisma.contact.update.mockResolvedValue(updatedContact);

      const res = await agent.patch('/api/contacts/contact-1').send({
        jobTitle: 'Chief Technology Officer',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('jobTitle', 'Chief Technology Officer');
    });

    it('should return 404 when contact not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.contact.findFirst.mockResolvedValue(null);

      const res = await agent.patch('/api/contacts/nonexistent').send({
        jobTitle: 'New Title',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/contacts/:id', () => {
    it('should delete contact and return 204', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const existingContact = {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        tenantId,
      };

      mockPrisma.contact.findFirst.mockResolvedValue(existingContact);
      mockPrisma.contact.delete.mockResolvedValue(existingContact);

      const res = await agent.delete('/api/contacts/contact-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 when contact not found', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      mockPrisma.contact.findFirst.mockResolvedValue(null);

      const res = await agent.delete('/api/contacts/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/contacts/:id/activities', () => {
    it('should return paginated activities for contact', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockContact = { id: 'contact-1', firstName: 'John', lastName: 'Doe', tenantId };
      const mockActivities = [
        {
          id: 'activity-1',
          subject: 'Follow-up call',
          tenantId,
          isCompleted: false,
          dueAt: new Date(),
          owner: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          relatedOrganization: null,
          relatedDeal: null,
          contacts: [{ contact: { id: 'contact-1', firstName: 'John', lastName: 'Doe' } }],
          organizations: [],
        },
      ];

      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities);
      mockPrisma.activity.count.mockResolvedValue(1);

      const res = await agent.get('/api/contacts/contact-1/activities');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/contacts/:id/notes', () => {
    it('should return paginated notes for contact', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockContact = { id: 'contact-1', firstName: 'John', lastName: 'Doe', tenantId };
      const mockNotes = [
        {
          id: 'note-1',
          content: 'Key decision maker',
          entityType: 'CONTACT',
          entityId: 'contact-1',
          tenantId,
          createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
          createdAt: new Date(),
        },
      ];

      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockPrisma.note.findMany.mockResolvedValue(mockNotes);
      mockPrisma.note.count.mockResolvedValue(1);

      const res = await agent.get('/api/contacts/contact-1/notes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/contacts/:id/notes', () => {
    it('should create note for contact and return 201', async () => {
      const agent = createAuthenticatedAgent({ userId, tenantId, role: 'ADMIN' });

      const mockContact = { id: 'contact-1', firstName: 'John', lastName: 'Doe', tenantId };
      const createdNote = {
        id: 'note-new',
        content: 'New note',
        entityType: 'CONTACT',
        entityId: 'contact-1',
        tenantId,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: userId, email: 'admin@demo.com', firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockPrisma.note.create.mockResolvedValue(createdNote);

      const res = await agent.post('/api/contacts/contact-1/notes').send({
        content: 'New note',
        entityType: 'CONTACT',
        entityId: 'contact-1',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'note-new');
      expect(res.body).toHaveProperty('content', 'New note');
    });
  });
});
