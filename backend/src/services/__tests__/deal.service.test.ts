import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../middleware/errorHandler';

const mockPrisma = vi.hoisted(() => ({
  deal: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  organization: { findFirst: vi.fn() },
  tenant: { findUnique: vi.fn() },
  dealContact: { deleteMany: vi.fn(), createMany: vi.fn() },
  activity: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

import { DealService } from '../deal.service';
import { AuditService } from '../audit.service';

describe('DealService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should validate organization exists, get tenant currency, create deal, and audit', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Acme Corp',
        tenantId: 'tenant-123',
      };

      const mockTenant = {
        id: 'tenant-123',
        currency: 'EUR',
      };

      const mockDeal = {
        id: 'deal-456',
        title: 'Enterprise Deal',
        organizationId: 'org-123',
        amount: 50000,
        currency: 'EUR',
        stage: 'LEAD',
        tenantId: 'tenant-123',
        createdByUserId: 'user-789',
        ownerUserId: 'user-789',
        organization: { id: 'org-123', name: 'Acme Corp' },
        owner: { id: 'user-789', email: 'user@example.com', firstName: 'John', lastName: 'Doe' },
        contacts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.findFirst.mockResolvedValue(mockOrg);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.deal.create.mockResolvedValue(mockDeal);

      const result = await DealService.create(
        {
          title: 'Enterprise Deal',
          organizationId: 'org-123',
          amount: 50000,
        },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: 'org-123', tenantId: 'tenant-123' },
      });

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        select: { currency: true },
      });

      expect(mockPrisma.deal.create).toHaveBeenCalledWith({
        data: {
          title: 'Enterprise Deal',
          organizationId: 'org-123',
          amount: 50000,
          currency: 'EUR',
          expectedCloseDate: null,
          stage: 'LEAD',
          probability: undefined,
          tenantId: 'tenant-123',
          createdByUserId: 'user-789',
          ownerUserId: 'user-789',
          contacts: undefined,
        },
        include: expect.any(Object),
      });

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        userId: 'user-789',
        entityType: 'DEAL',
        entityId: 'deal-456',
        action: 'CREATE',
        afterData: { title: 'Enterprise Deal', stage: 'LEAD', amount: 50000 },
      });

      expect(result).toEqual(mockDeal);
    });

    it('should default to USD if tenant currency is not set', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'org-123', tenantId: 'tenant-123' });
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.deal.create.mockResolvedValue({
        id: 'deal-456',
        currency: 'USD',
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-789', email: 'user@example.com' },
        contacts: [],
      });

      await DealService.create(
        { title: 'Test Deal', organizationId: 'org-123' },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'USD',
          }),
        })
      );
    });

    it('should throw 404 for invalid organization', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        DealService.create(
          { title: 'Test Deal', organizationId: 'invalid-org' },
          'tenant-123',
          'user-789'
        )
      ).rejects.toThrow(new AppError(404, 'Organization not found'));
    });

    it('should create deal with contacts when contactIds provided', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'org-123', tenantId: 'tenant-123' });
      mockPrisma.tenant.findUnique.mockResolvedValue({ currency: 'USD' });
      mockPrisma.deal.create.mockResolvedValue({
        id: 'deal-456',
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-789', email: 'user@example.com' },
        contacts: [
          { contact: { id: 'contact-1', firstName: 'Jane', lastName: 'Smith', emails: [] } },
        ],
      });

      await DealService.create(
        {
          title: 'Test Deal',
          organizationId: 'org-123',
          contactIds: ['contact-1', 'contact-2'],
        },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contacts: {
              create: [
                { contact: { connect: { id: 'contact-1' } } },
                { contact: { connect: { id: 'contact-2' } } },
              ],
            },
          }),
        })
      );
    });
  });

  describe('findAll', () => {
    it('should apply stage filter', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockPrisma.deal.count.mockResolvedValue(0);

      await DealService.findAll({
        tenantId: 'tenant-123',
        stage: 'PROSPECT',
      });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            stage: 'PROSPECT',
          },
        })
      );
    });

    it('should apply search filter', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockPrisma.deal.count.mockResolvedValue(0);

      await DealService.findAll({
        tenantId: 'tenant-123',
        search: 'enterprise',
      });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            OR: [
              { title: { contains: 'enterprise', mode: 'insensitive' } },
              { organization: { name: { contains: 'enterprise', mode: 'insensitive' } } },
            ],
          },
        })
      );
    });

    it('should apply organizationId filter', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockPrisma.deal.count.mockResolvedValue(0);

      await DealService.findAll({
        tenantId: 'tenant-123',
        organizationId: 'org-123',
      });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            organizationId: 'org-123',
          },
        })
      );
    });

    it('should return paginated results', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          title: 'Deal 1',
          organization: { id: 'org-1', name: 'Org 1' },
          owner: { id: 'user-1', email: 'user1@example.com' },
          contacts: [],
          _count: { activities: 5 },
        },
      ];

      mockPrisma.deal.findMany.mockResolvedValue(mockDeals);
      mockPrisma.deal.count.mockResolvedValue(50);

      const result = await DealService.findAll({
        tenantId: 'tenant-123',
        page: 2,
        limit: 10,
      });

      expect(result).toEqual({
        data: mockDeals,
        pagination: {
          page: 2,
          limit: 10,
          total: 50,
          totalPages: 5,
        },
      });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should apply custom sorting', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockPrisma.deal.count.mockResolvedValue(0);

      await DealService.findAll({
        tenantId: 'tenant-123',
        sortBy: 'amount',
        sortOrder: 'asc',
      });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amount: 'asc' },
        })
      );
    });
  });

  describe('findById', () => {
    it('should return deal when found', async () => {
      const mockDeal = {
        id: 'deal-123',
        title: 'Test Deal',
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        createdBy: { id: 'user-1', email: 'user@example.com' },
        updatedBy: null,
        contacts: [],
        _count: { activities: 3 },
      };

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);

      const result = await DealService.findById('deal-123', 'tenant-123');

      expect(mockPrisma.deal.findFirst).toHaveBeenCalledWith({
        where: { id: 'deal-123', tenantId: 'tenant-123' },
        include: expect.any(Object),
      });

      expect(result).toEqual(mockDeal);
    });

    it('should throw 404 when deal not found', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);

      await expect(DealService.findById('invalid-id', 'tenant-123')).rejects.toThrow(
        new AppError(404, 'Deal not found')
      );
    });
  });

  describe('update', () => {
    const mockExistingDeal = {
      id: 'deal-123',
      title: 'Old Title',
      stage: 'LEAD',
      amount: 10000,
      ownerUserId: 'user-1',
      tenantId: 'tenant-123',
    };

    it('should throw 400 when stage is LOST and reasonLost is missing', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);

      await expect(
        DealService.update(
          'deal-123',
          { stage: 'LOST' },
          'tenant-123',
          'user-789'
        )
      ).rejects.toThrow(new AppError(400, 'Reason for loss is required when marking deal as lost'));
    });

    it('should update deal successfully', async () => {
      const mockUpdatedDeal = {
        ...mockExistingDeal,
        title: 'New Title',
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      };

      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);
      mockPrisma.deal.update.mockResolvedValue(mockUpdatedDeal);

      const result = await DealService.update(
        'deal-123',
        { title: 'New Title' },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-123' },
        data: expect.objectContaining({
          title: 'New Title',
          updatedByUserId: 'user-789',
        }),
        include: expect.any(Object),
      });

      expect(result).toEqual(mockUpdatedDeal);
    });

    it('should audit stage change', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);
      mockPrisma.deal.update.mockResolvedValue({
        ...mockExistingDeal,
        stage: 'PROSPECT',
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      });

      await DealService.update(
        'deal-123',
        { stage: 'PROSPECT' },
        'tenant-123',
        'user-789'
      );

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        userId: 'user-789',
        entityType: 'DEAL',
        entityId: 'deal-123',
        action: 'STAGE_CHANGE',
        beforeData: { stage: 'LEAD' },
        afterData: { stage: 'PROSPECT' },
      });
    });

    it('should audit amount change', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);
      mockPrisma.deal.update.mockResolvedValue({
        ...mockExistingDeal,
        amount: 20000,
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      });

      await DealService.update(
        'deal-123',
        { amount: 20000 },
        'tenant-123',
        'user-789'
      );

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        userId: 'user-789',
        entityType: 'DEAL',
        entityId: 'deal-123',
        action: 'AMOUNT_CHANGE',
        beforeData: { amount: 10000 },
        afterData: { amount: 20000 },
      });
    });

    it('should audit owner change', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);
      mockPrisma.deal.update.mockResolvedValue({
        ...mockExistingDeal,
        ownerUserId: 'user-2',
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-2', email: 'user2@example.com' },
        contacts: [],
      });

      await DealService.update(
        'deal-123',
        { ownerUserId: 'user-2' },
        'tenant-123',
        'user-789'
      );

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        userId: 'user-789',
        entityType: 'DEAL',
        entityId: 'deal-123',
        action: 'OWNER_CHANGE',
        beforeData: { ownerUserId: 'user-1' },
        afterData: { ownerUserId: 'user-2' },
      });
    });

    it('should set closedAt when stage moves to WON (issue #23)', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);
      mockPrisma.deal.update.mockResolvedValue({
        ...mockExistingDeal,
        stage: 'WON',
        closedAt: expect.any(Date),
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      });

      await DealService.update(
        'deal-123',
        { stage: 'WON' },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-123' },
        data: expect.objectContaining({
          stage: 'WON',
          closedAt: expect.any(Date),
          updatedByUserId: 'user-789',
        }),
        include: expect.any(Object),
      });
    });

    it('should set closedAt when stage moves to LOST (issue #23)', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);
      mockPrisma.deal.update.mockResolvedValue({
        ...mockExistingDeal,
        stage: 'LOST',
        reasonLost: 'Budget constraints',
        closedAt: expect.any(Date),
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      });

      await DealService.update(
        'deal-123',
        { stage: 'LOST', reasonLost: 'Budget constraints' },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-123' },
        data: expect.objectContaining({
          stage: 'LOST',
          reasonLost: 'Budget constraints',
          closedAt: expect.any(Date),
          updatedByUserId: 'user-789',
        }),
        include: expect.any(Object),
      });
    });

    it('should clear closedAt when reopening a deal (issue #23)', async () => {
      const closedDeal = {
        ...mockExistingDeal,
        stage: 'WON',
        closedAt: new Date(),
      };

      mockPrisma.deal.findFirst.mockResolvedValue(closedDeal);
      mockPrisma.deal.update.mockResolvedValue({
        ...closedDeal,
        stage: 'PROSPECT',
        closedAt: null,
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      });

      await DealService.update(
        'deal-123',
        { stage: 'PROSPECT' },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-123' },
        data: expect.objectContaining({
          stage: 'PROSPECT',
          closedAt: null,
          updatedByUserId: 'user-789',
        }),
        include: expect.any(Object),
      });
    });

    it('should delete and recreate contacts when contactIds provided', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockExistingDeal);
      mockPrisma.deal.update.mockResolvedValue({
        ...mockExistingDeal,
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      });

      await DealService.update(
        'deal-123',
        { contactIds: ['contact-1', 'contact-2'] },
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.dealContact.deleteMany).toHaveBeenCalledWith({
        where: { dealId: 'deal-123' },
      });

      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contacts: {
              create: [
                { contact: { connect: { id: 'contact-1' } } },
                { contact: { connect: { id: 'contact-2' } } },
              ],
            },
          }),
        })
      );
    });
  });

  describe('updateStage', () => {
    it('should call update with stage and reasonLost', async () => {
      const mockDeal = {
        id: 'deal-123',
        stage: 'LEAD',
        tenantId: 'tenant-123',
        organization: { id: 'org-123', name: 'Acme' },
        owner: { id: 'user-1', email: 'user@example.com' },
        contacts: [],
      };

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.deal.update.mockResolvedValue({ ...mockDeal, stage: 'LOST' });

      await DealService.updateStage(
        'deal-123',
        'LOST',
        'Budget constraints',
        'tenant-123',
        'user-789'
      );

      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: 'LOST',
            reasonLost: 'Budget constraints',
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete deal and audit', async () => {
      const mockDeal = {
        id: 'deal-123',
        title: 'Test Deal',
        tenantId: 'tenant-123',
      };

      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.deal.delete.mockResolvedValue(mockDeal);

      await DealService.delete('deal-123', 'tenant-123', 'user-789');

      expect(mockPrisma.deal.findFirst).toHaveBeenCalledWith({
        where: { id: 'deal-123', tenantId: 'tenant-123' },
        include: expect.any(Object),
      });

      expect(mockPrisma.deal.delete).toHaveBeenCalledWith({
        where: { id: 'deal-123' },
      });

      expect(AuditService.log).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        userId: 'user-789',
        entityType: 'DEAL',
        entityId: 'deal-123',
        action: 'DELETE',
      });
    });
  });

  describe('getPipeline', () => {
    it('should group deals by stage and return counts and sums', async () => {
      const mockGroupedDeals = [
        { stage: 'LEAD', _count: { _all: 5 }, _sum: { amount: 25000 } },
        { stage: 'PROSPECT', _count: { _all: 3 }, _sum: { amount: 45000 } },
        { stage: 'WON', _count: { _all: 2 }, _sum: { amount: 100000 } },
      ];

      mockPrisma.deal.groupBy.mockResolvedValue(mockGroupedDeals);

      const result = await DealService.getPipeline('tenant-123');

      expect(mockPrisma.deal.groupBy).toHaveBeenCalledWith({
        by: ['stage'],
        where: { tenantId: 'tenant-123' },
        _count: { _all: true },
        _sum: { amount: true },
      });

      expect(result).toEqual([
        { stage: 'LEAD', count: 5, totalAmount: 25000 },
        { stage: 'PROSPECT', count: 3, totalAmount: 45000 },
        { stage: 'QUOTE', count: 0, totalAmount: 0 },
        { stage: 'WON', count: 2, totalAmount: 100000 },
        { stage: 'LOST', count: 0, totalAmount: 0 },
      ]);
    });

    it('should return zero counts for stages with no deals', async () => {
      mockPrisma.deal.groupBy.mockResolvedValue([]);

      const result = await DealService.getPipeline('tenant-123');

      expect(result).toEqual([
        { stage: 'LEAD', count: 0, totalAmount: 0 },
        { stage: 'PROSPECT', count: 0, totalAmount: 0 },
        { stage: 'QUOTE', count: 0, totalAmount: 0 },
        { stage: 'WON', count: 0, totalAmount: 0 },
        { stage: 'LOST', count: 0, totalAmount: 0 },
      ]);
    });
  });
});
