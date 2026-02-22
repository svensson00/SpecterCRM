import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../middleware/errorHandler';

// Create mocks BEFORE imports
const mockPrisma = vi.hoisted(() => ({
  organization: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  contact: { findMany: vi.fn(), count: vi.fn() },
  deal: { findMany: vi.fn(), count: vi.fn() },
  activity: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

// Import AFTER mocks
import { OrganizationService } from '../organization.service';
import { AuditService } from '../audit.service';

describe('OrganizationService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should check for duplicates, create organization, and log audit', async () => {
      const orgData = {
        name: 'Acme Corp',
        website: 'https://acme.com',
        street: '123 Main St',
        city: 'Stockholm',
        zip: '12345',
        country: 'Sweden',
        ownerUserId: 'owner-123',
      };

      const createdOrg = {
        id: 'org-123',
        ...orgData,
        tenantId,
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: 'owner-123', email: 'owner@example.com', firstName: 'John', lastName: 'Doe' },
        createdBy: { id: userId, email: 'user@example.com', firstName: 'Jane', lastName: 'Smith' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(createdOrg);

      const result = await OrganizationService.create(orgData, tenantId, userId);

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId,
          name: {
            equals: orgData.name,
            mode: 'insensitive',
          },
        },
      });

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          ...orgData,
          tenantId,
          createdByUserId: userId,
        },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId,
        userId,
        entityType: 'ORGANIZATION',
        entityId: createdOrg.id,
        action: 'CREATE',
        afterData: { name: createdOrg.name },
      });

      expect(result).toEqual(createdOrg);
    });

    it('should throw 409 error when duplicate name is found', async () => {
      const orgData = {
        name: 'Acme Corp',
        website: 'https://acme.com',
      };

      const existingOrg = {
        id: 'existing-org-123',
        name: 'ACME CORP',
        tenantId,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);

      await expect(
        OrganizationService.create(orgData, tenantId, userId)
      ).rejects.toThrow(new AppError(409, 'An organization with this name already exists'));

      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
      expect(AuditService.log).not.toHaveBeenCalled();
    });

    it('should use createdByUserId as ownerUserId when not provided', async () => {
      const orgData = {
        name: 'Acme Corp',
      };

      const createdOrg = {
        id: 'org-123',
        name: orgData.name,
        tenantId,
        createdByUserId: userId,
        ownerUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: userId, email: 'user@example.com', firstName: 'Jane', lastName: 'Smith' },
        createdBy: { id: userId, email: 'user@example.com', firstName: 'Jane', lastName: 'Smith' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(createdOrg);

      const result = await OrganizationService.create(orgData, tenantId, userId);

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: orgData.name,
          tenantId,
          createdByUserId: userId,
          ownerUserId: userId,
        },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      expect(result.ownerUserId).toBe(userId);
    });
  });

  describe('findAll', () => {
    it('should build where clause with tenantId and return paginated response', async () => {
      const organizations = [
        {
          id: 'org-1',
          name: 'Org One',
          tenantId,
          owner: { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
          _count: { contacts: 5, deals: 3, activities: 10 },
        },
        {
          id: 'org-2',
          name: 'Org Two',
          tenantId,
          owner: { id: 'user-2', email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
          _count: { contacts: 2, deals: 1, activities: 5 },
        },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(organizations);
      mockPrisma.organization.count.mockResolvedValue(25);

      const result = await OrganizationService.findAll({
        tenantId,
        page: 2,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: {
            select: { contacts: true, deals: true, activities: true },
          },
        },
        orderBy: { name: 'asc' },
        skip: 10,
        take: 10,
      });

      expect(mockPrisma.organization.count).toHaveBeenCalledWith({
        where: { tenantId },
      });

      expect(result).toEqual({
        data: organizations,
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      });
    });

    it('should apply search filter to name, website, and city', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([]);
      mockPrisma.organization.count.mockResolvedValue(0);

      await OrganizationService.findAll({
        tenantId,
        search: 'acme',
      });

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            OR: [
              { name: { contains: 'acme', mode: 'insensitive' } },
              { website: { contains: 'acme', mode: 'insensitive' } },
              { city: { contains: 'acme', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should apply ownerUserId filter when provided', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([]);
      mockPrisma.organization.count.mockResolvedValue(0);

      await OrganizationService.findAll({
        tenantId,
        ownerUserId: 'owner-123',
      });

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            ownerUserId: 'owner-123',
          },
        })
      );
    });

    it('should use default pagination values', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([]);
      mockPrisma.organization.count.mockResolvedValue(0);

      await OrganizationService.findAll({ tenantId });

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        })
      );
    });
  });

  describe('findById', () => {
    it('should return organization when found', async () => {
      const organization = {
        id: 'org-123',
        name: 'Acme Corp',
        tenantId,
        owner: { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
        createdBy: { id: 'user-2', email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
        updatedBy: { id: 'user-3', email: 'user3@example.com', firstName: 'User', lastName: 'Three' },
        _count: { contacts: 5, deals: 3, activities: 10 },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);

      const result = await OrganizationService.findById('org-123', tenantId);

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: 'org-123', tenantId },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: {
            select: { contacts: true, deals: true, activities: true },
          },
        },
      });

      expect(result).toEqual(organization);
    });

    it('should throw 404 error when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganizationService.findById('nonexistent-org', tenantId)
      ).rejects.toThrow(new AppError(404, 'Organization not found'));
    });
  });

  describe('update', () => {
    it('should update organization and log audit', async () => {
      const existingOrg = {
        id: 'org-123',
        name: 'Acme Corp',
        website: 'https://acme.com',
        tenantId,
        ownerUserId: 'owner-123',
      };

      const updateData = {
        name: 'Acme Corporation',
        website: 'https://acme.io',
      };

      const updatedOrg = {
        ...existingOrg,
        ...updateData,
        owner: { id: 'owner-123', email: 'owner@example.com', firstName: 'John', lastName: 'Doe' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.update.mockResolvedValue(updatedOrg);

      const result = await OrganizationService.update('org-123', updateData, tenantId, userId);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          ...updateData,
          updatedByUserId: userId,
        },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId,
        userId,
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        action: 'UPDATE',
        beforeData: existingOrg,
        afterData: updatedOrg,
      });

      expect(result).toEqual(updatedOrg);
    });

    it('should log OWNER_CHANGE audit when owner changes', async () => {
      const existingOrg = {
        id: 'org-123',
        name: 'Acme Corp',
        tenantId,
        ownerUserId: 'old-owner',
      };

      const updateData = {
        ownerUserId: 'new-owner',
      };

      const updatedOrg = {
        ...existingOrg,
        ownerUserId: 'new-owner',
        owner: { id: 'new-owner', email: 'newowner@example.com', firstName: 'New', lastName: 'Owner' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.update.mockResolvedValue(updatedOrg);

      await OrganizationService.update('org-123', updateData, tenantId, userId);

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId,
        userId,
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        action: 'OWNER_CHANGE',
        beforeData: { ownerUserId: 'old-owner' },
        afterData: { ownerUserId: 'new-owner' },
      });

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId,
        userId,
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        action: 'UPDATE',
        beforeData: existingOrg,
        afterData: updatedOrg,
      });

      expect(AuditService.log).toHaveBeenCalledTimes(2);
    });

    it('should not log OWNER_CHANGE when owner does not change', async () => {
      const existingOrg = {
        id: 'org-123',
        name: 'Acme Corp',
        tenantId,
        ownerUserId: 'owner-123',
      };

      const updateData = {
        name: 'Acme Corporation',
      };

      const updatedOrg = {
        ...existingOrg,
        ...updateData,
        owner: { id: 'owner-123', email: 'owner@example.com', firstName: 'John', lastName: 'Doe' },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.update.mockResolvedValue(updatedOrg);

      await OrganizationService.update('org-123', updateData, tenantId, userId);

      expect(AuditService.log).toHaveBeenCalledTimes(1);
      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId,
        userId,
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        action: 'UPDATE',
        beforeData: existingOrg,
        afterData: updatedOrg,
      });
    });
  });

  describe('delete', () => {
    it('should delete organization and log audit', async () => {
      const existingOrg = {
        id: 'org-123',
        name: 'Acme Corp',
        tenantId,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.delete.mockResolvedValue(existingOrg);

      await OrganizationService.delete('org-123', tenantId, userId);

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: 'org-123', tenantId },
        include: expect.any(Object),
      });

      expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId,
        userId,
        entityType: 'ORGANIZATION',
        entityId: 'org-123',
        action: 'DELETE',
      });
    });

    it('should throw 404 when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganizationService.delete('nonexistent-org', tenantId, userId)
      ).rejects.toThrow(new AppError(404, 'Organization not found'));

      expect(mockPrisma.organization.delete).not.toHaveBeenCalled();
      expect(AuditService.log).not.toHaveBeenCalled();
    });
  });

  describe('getContacts', () => {
    it('should return paginated contacts for organization', async () => {
      const organization = { id: 'org-123', name: 'Acme Corp', tenantId };

      const contacts = [
        {
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
          tenantId,
          primaryOrganizationId: 'org-123',
          emails: [{ email: 'john@example.com' }],
          phones: [{ phone: '123-456-7890' }],
          owner: { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
        },
        {
          id: 'contact-2',
          firstName: 'Jane',
          lastName: 'Smith',
          tenantId,
          primaryOrganizationId: 'org-123',
          emails: [{ email: 'jane@example.com' }],
          phones: [],
          owner: { id: 'user-2', email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.contact.findMany.mockResolvedValue(contacts);
      mockPrisma.contact.count.mockResolvedValue(15);

      const result = await OrganizationService.getContacts('org-123', tenantId, 2, 10);

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
        where: { tenantId, primaryOrganizationId: 'org-123' },
        include: {
          emails: true,
          phones: true,
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.contact.count).toHaveBeenCalledWith({
        where: { tenantId, primaryOrganizationId: 'org-123' },
      });

      expect(result).toEqual({
        data: contacts,
        pagination: {
          page: 2,
          limit: 10,
          total: 15,
          totalPages: 2,
        },
      });
    });

    it('should throw 404 when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganizationService.getContacts('nonexistent-org', tenantId)
      ).rejects.toThrow(new AppError(404, 'Organization not found'));

      expect(mockPrisma.contact.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getDeals', () => {
    it('should return paginated deals for organization', async () => {
      const organization = { id: 'org-123', name: 'Acme Corp', tenantId };

      const deals = [
        {
          id: 'deal-1',
          title: 'Q1 Project',
          tenantId,
          organizationId: 'org-123',
          amount: 50000,
          stage: 'PROSPECT',
          owner: { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
        },
        {
          id: 'deal-2',
          title: 'Q2 Project',
          tenantId,
          organizationId: 'org-123',
          amount: 75000,
          stage: 'QUOTE',
          owner: { id: 'user-2', email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.deal.findMany.mockResolvedValue(deals);
      mockPrisma.deal.count.mockResolvedValue(8);

      const result = await OrganizationService.getDeals('org-123', tenantId, 1, 5);

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith({
        where: { tenantId, organizationId: 'org-123' },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        skip: 0,
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.deal.count).toHaveBeenCalledWith({
        where: { tenantId, organizationId: 'org-123' },
      });

      expect(result).toEqual({
        data: deals,
        pagination: {
          page: 1,
          limit: 5,
          total: 8,
          totalPages: 2,
        },
      });
    });

    it('should throw 404 when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganizationService.getDeals('nonexistent-org', tenantId)
      ).rejects.toThrow(new AppError(404, 'Organization not found'));

      expect(mockPrisma.deal.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getActivities', () => {
    it('should return paginated activities for organization', async () => {
      const organization = { id: 'org-123', name: 'Acme Corp', tenantId };

      const activities = [
        {
          id: 'activity-1',
          subject: 'Follow-up call',
          tenantId,
          relatedOrganizationId: 'org-123',
          isCompleted: false,
          dueAt: new Date('2026-03-01'),
          owner: { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
          relatedOrganization: { id: 'org-123', name: 'Acme Corp' },
          relatedDeal: null,
          contacts: [],
          organizations: [],
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.activity.findMany.mockResolvedValue(activities);
      mockPrisma.activity.count.mockResolvedValue(12);

      const result = await OrganizationService.getActivities('org-123', tenantId, 1, 10);

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          OR: [
            { relatedOrganizationId: 'org-123' },
            { organizations: { some: { organizationId: 'org-123' } } },
          ],
        },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          relatedOrganization: { select: { id: true, name: true } },
          relatedDeal: { select: { id: true, title: true } },
          contacts: {
            include: {
              contact: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          organizations: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { dueAt: 'asc' },
      });

      expect(result).toEqual({
        data: activities,
        pagination: {
          page: 1,
          limit: 10,
          total: 12,
          totalPages: 2,
        },
      });
    });

    it('should apply isCompleted filter when provided', async () => {
      const organization = { id: 'org-123', name: 'Acme Corp', tenantId };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.activity.count.mockResolvedValue(0);

      await OrganizationService.getActivities('org-123', tenantId, 1, 10, true);

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isCompleted: true,
          }),
        })
      );
    });

    it('should apply date range filters when provided', async () => {
      const organization = { id: 'org-123', name: 'Acme Corp', tenantId };
      const startDate = '2026-02-01';
      const endDate = '2026-02-28';

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.activity.count.mockResolvedValue(0);

      await OrganizationService.getActivities('org-123', tenantId, 1, 10, undefined, startDate, endDate);

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        })
      );
    });

    it('should throw 404 when organization not found', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        OrganizationService.getActivities('nonexistent-org', tenantId)
      ).rejects.toThrow(new AppError(404, 'Organization not found'));

      expect(mockPrisma.activity.findMany).not.toHaveBeenCalled();
    });
  });
});
