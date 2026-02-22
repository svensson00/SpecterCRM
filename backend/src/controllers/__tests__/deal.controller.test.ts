import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { DealController } from '../deal.controller';

const mockDealService = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  updateStage: vi.fn(),
  delete: vi.fn(),
  getPipeline: vi.fn(),
  getActivities: vi.fn(),
}));

const mockNoteService = vi.hoisted(() => ({
  findByEntity: vi.fn(),
  findByEntityPaginated: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../services/deal.service', () => ({
  DealService: mockDealService,
}));

vi.mock('../../services/note.service', () => ({
  NoteService: mockNoteService,
}));

describe('DealController', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    sendMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
    mockReq = {
      user: { userId: 'user-123', tenantId: 'tenant-123', email: 'user@example.com', role: 'USER' },
    };
  });

  describe('create', () => {
    it('should create deal and return 201', async () => {
      const dealData = {
        title: 'Enterprise Deal',
        organizationId: 'org-123',
        amount: 50000,
        expectedCloseDate: '2026-03-31T00:00:00.000Z',
      };
      const createdDeal = {
        id: 'deal-123',
        ...dealData,
        stage: 'LEAD',
        currency: 'USD',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = dealData;
      mockDealService.create.mockResolvedValue(createdDeal);

      await DealController.create(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.create).toHaveBeenCalledWith(
        {
          title: 'Enterprise Deal',
          organizationId: 'org-123',
          amount: 50000,
          expectedCloseDate: '2026-03-31T00:00:00.000Z',
          currency: 'USD',
          stage: 'LEAD',
        },
        'tenant-123',
        'user-123'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdDeal);
    });

    it('should convert null expectedCloseDate to undefined', async () => {
      const dealData = {
        title: 'Enterprise Deal',
        organizationId: 'org-123',
        amount: 50000,
        expectedCloseDate: null,
      };
      const createdDeal = {
        id: 'deal-123',
        title: 'Enterprise Deal',
        organizationId: 'org-123',
        amount: 50000,
        stage: 'LEAD',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = dealData;
      mockDealService.create.mockResolvedValue(createdDeal);

      await DealController.create(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.create).toHaveBeenCalledWith(
        {
          title: 'Enterprise Deal',
          organizationId: 'org-123',
          amount: 50000,
          expectedCloseDate: undefined,
          currency: 'USD',
          stage: 'LEAD',
        },
        'tenant-123',
        'user-123'
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated deals', async () => {
      const paginatedResult = {
        data: [
          { id: 'deal-1', title: 'Deal 1', tenantId: 'tenant-123' },
          { id: 'deal-2', title: 'Deal 2', tenantId: 'tenant-123' },
        ],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      };

      mockReq.query = { page: '1', limit: '20' };
      mockDealService.findAll.mockResolvedValue(paginatedResult);

      await DealController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        stage: undefined,
        ownerUserId: undefined,
        organizationId: undefined,
        search: undefined,
        sortBy: undefined,
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });

    it('should apply stage, ownerUserId, organizationId, and search filters', async () => {
      const paginatedResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.query = {
        page: '1',
        limit: '20',
        stage: 'PROSPECT',
        ownerUserId: 'owner-456',
        organizationId: 'org-789',
        search: 'enterprise',
      };
      mockDealService.findAll.mockResolvedValue(paginatedResult);

      await DealController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        stage: 'PROSPECT',
        ownerUserId: 'owner-456',
        organizationId: 'org-789',
        search: 'enterprise',
        sortBy: undefined,
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findById', () => {
    it('should return deal by id', async () => {
      const deal = {
        id: 'deal-123',
        title: 'Enterprise Deal',
        tenantId: 'tenant-123',
      };

      mockReq.params = { id: 'deal-123' };
      mockDealService.findById.mockResolvedValue(deal);

      await DealController.findById(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.findById).toHaveBeenCalledWith('deal-123', 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(deal);
    });
  });

  describe('update', () => {
    it('should update deal and return updated data', async () => {
      const updateData = { title: 'Updated Deal', amount: 75000 };
      const updatedDeal = {
        id: 'deal-123',
        title: 'Updated Deal',
        amount: 75000,
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.body = updateData;
      mockDealService.update.mockResolvedValue(updatedDeal);

      await DealController.update(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.update).toHaveBeenCalledWith('deal-123', updateData, 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(updatedDeal);
    });

    it('should convert null expectedCloseDate to undefined', async () => {
      const updateData = { expectedCloseDate: null };
      const updatedDeal = {
        id: 'deal-123',
        title: 'Deal',
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.body = updateData;
      mockDealService.update.mockResolvedValue(updatedDeal);

      await DealController.update(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.update).toHaveBeenCalledWith(
        'deal-123',
        { expectedCloseDate: undefined },
        'tenant-123',
        'user-123'
      );
    });
  });

  describe('updateStage', () => {
    it('should update deal stage', async () => {
      const updatedDeal = {
        id: 'deal-123',
        title: 'Deal',
        stage: 'PROSPECT',
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.body = { stage: 'PROSPECT' };
      mockDealService.updateStage.mockResolvedValue(updatedDeal);

      await DealController.updateStage(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.updateStage).toHaveBeenCalledWith(
        'deal-123',
        'PROSPECT',
        undefined,
        'tenant-123',
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(updatedDeal);
    });

    it('should update deal stage to LOST with reasonLost', async () => {
      const updatedDeal = {
        id: 'deal-123',
        title: 'Deal',
        stage: 'LOST',
        reasonLost: 'Budget constraints',
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.body = { stage: 'LOST', reasonLost: 'Budget constraints' };
      mockDealService.updateStage.mockResolvedValue(updatedDeal);

      await DealController.updateStage(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.updateStage).toHaveBeenCalledWith(
        'deal-123',
        'LOST',
        'Budget constraints',
        'tenant-123',
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(updatedDeal);
    });
  });

  describe('delete', () => {
    it('should delete deal and return 204', async () => {
      mockReq.params = { id: 'deal-123' };

      await DealController.delete(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.delete).toHaveBeenCalledWith('deal-123', 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('getNotes', () => {
    it('should return notes for deal', async () => {
      const paginatedResult = {
        data: [
          { id: 'note-1', content: 'Test note', entityType: 'DEAL', entityId: 'deal-123' },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockNoteService.findByEntityPaginated.mockResolvedValue(paginatedResult);

      await DealController.getNotes(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.findByEntityPaginated).toHaveBeenCalledWith('DEAL', 'deal-123', 'tenant-123', 1, 20);
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });
  });

  describe('createNote', () => {
    it('should create note and return 201', async () => {
      const noteData = {
        content: 'New note',
        entityType: 'DEAL',
        entityId: 'deal-123'
      };
      const createdNote = {
        id: 'note-123',
        content: 'New note',
        entityType: 'DEAL',
        entityId: 'deal-123',
        tenantId: 'tenant-123',
        createdAt: new Date(),
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.body = noteData;
      mockNoteService.create.mockResolvedValue(createdNote);

      await DealController.createNote(mockReq as AuthRequest, mockRes as Response);

      expect(mockNoteService.create).toHaveBeenCalledWith(
        { content: 'New note', entityType: 'DEAL', entityId: 'deal-123' },
        'tenant-123',
        'user-123'
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdNote);
    });
  });

  describe('getPipeline', () => {
    it('should return pipeline summary', async () => {
      const pipelineSummary = [
        { stage: 'LEAD', count: 5, totalAmount: 25000 },
        { stage: 'PROSPECT', count: 3, totalAmount: 45000 },
        { stage: 'QUOTE', count: 2, totalAmount: 60000 },
        { stage: 'WON', count: 1, totalAmount: 50000 },
        { stage: 'LOST', count: 1, totalAmount: 10000 },
      ];

      mockReq.query = {};
      mockDealService.getPipeline.mockResolvedValue(pipelineSummary);

      await DealController.getPipeline(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.getPipeline).toHaveBeenCalledWith('tenant-123', undefined);
      expect(mockRes.json).toHaveBeenCalledWith(pipelineSummary);
    });
  });

  describe('getActivities', () => {
    it('should return paginated activities for deal', async () => {
      const activitiesResult = {
        data: [
          { id: 'activity-1', subject: 'Follow-up call', relatedDealId: 'deal-123' },
        ],
        pagination: { page: 1, limit: 20, total: 10, totalPages: 1 },
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.query = { page: '1', limit: '20' };
      mockDealService.getActivities.mockResolvedValue(activitiesResult);

      await DealController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.getActivities).toHaveBeenCalledWith(
        'deal-123',
        'tenant-123',
        1,
        20,
        undefined,
        undefined,
        undefined
      );
      expect(mockRes.json).toHaveBeenCalledWith(activitiesResult);
    });

    it('should apply isCompleted filter', async () => {
      const activitiesResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.query = { page: '1', limit: '20', isCompleted: 'true' };
      mockDealService.getActivities.mockResolvedValue(activitiesResult);

      await DealController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.getActivities).toHaveBeenCalledWith(
        'deal-123',
        'tenant-123',
        1,
        20,
        true,
        undefined,
        undefined
      );
    });

    it('should apply date range filters', async () => {
      const activitiesResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.params = { id: 'deal-123' };
      mockReq.query = { page: '1', limit: '20', startDate: '2026-02-01', endDate: '2026-02-28' };
      mockDealService.getActivities.mockResolvedValue(activitiesResult);

      await DealController.getActivities(mockReq as AuthRequest, mockRes as Response);

      expect(mockDealService.getActivities).toHaveBeenCalledWith(
        'deal-123',
        'tenant-123',
        1,
        20,
        undefined,
        '2026-02-01',
        '2026-02-28'
      );
    });
  });
});
