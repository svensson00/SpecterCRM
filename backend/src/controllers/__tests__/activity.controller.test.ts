import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ActivityController } from '../activity.controller';

const mockActivityService = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  toggleComplete: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../services/activity.service', () => ({
  ActivityService: mockActivityService,
}));

describe('ActivityController', () => {
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
    it('should create activity and return 201', async () => {
      const activityData = {
        type: 'Workshop',
        subject: 'Tech Workshop',
        description: 'Deep dive into streaming tech',
        dueAt: '2026-03-15T10:00:00Z',
        relatedOrganizationId: 'org-123',
      };
      const createdActivity = {
        id: 'activity-123',
        ...activityData,
        isCompleted: false,
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = activityData;
      mockActivityService.create.mockResolvedValue(createdActivity);

      await ActivityController.create(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.create).toHaveBeenCalledWith(activityData, 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdActivity);
    });
  });

  describe('findAll', () => {
    it('should return paginated activities', async () => {
      const paginatedResult = {
        data: [
          { id: 'activity-1', subject: 'Follow-up call', tenantId: 'tenant-123' },
          { id: 'activity-2', subject: 'POC Demo', tenantId: 'tenant-123' },
        ],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      };

      mockReq.query = { page: '1', limit: '20' };
      mockActivityService.findAll.mockResolvedValue(paginatedResult);

      await ActivityController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        search: undefined,
        type: undefined,
        ownerUserId: undefined,
        isCompleted: undefined,
        startDate: undefined,
        endDate: undefined,
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });

    it('should apply all filters', async () => {
      const paginatedResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.query = {
        page: '1',
        limit: '20',
        search: 'workshop',
        type: 'Workshop',
        ownerUserId: 'owner-456',
        isCompleted: 'false',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      };
      mockActivityService.findAll.mockResolvedValue(paginatedResult);

      await ActivityController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        search: 'workshop',
        type: 'Workshop',
        ownerUserId: 'owner-456',
        isCompleted: false,
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
    });

    it('should parse isCompleted=true correctly', async () => {
      const paginatedResult = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockReq.query = { page: '1', limit: '20', isCompleted: 'true' };
      mockActivityService.findAll.mockResolvedValue(paginatedResult);

      await ActivityController.findAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          isCompleted: true,
        })
      );
    });
  });

  describe('findById', () => {
    it('should return activity by id', async () => {
      const activity = {
        id: 'activity-123',
        subject: 'Follow-up call',
        tenantId: 'tenant-123',
      };

      mockReq.params = { id: 'activity-123' };
      mockActivityService.findById.mockResolvedValue(activity);

      await ActivityController.findById(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.findById).toHaveBeenCalledWith('activity-123', 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(activity);
    });
  });

  describe('update', () => {
    it('should update activity and return updated data', async () => {
      const updateData = { subject: 'Updated subject' };
      const updatedActivity = {
        id: 'activity-123',
        subject: 'Updated subject',
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'activity-123' };
      mockReq.body = updateData;
      mockActivityService.update.mockResolvedValue(updatedActivity);

      await ActivityController.update(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.update).toHaveBeenCalledWith('activity-123', updateData, 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(updatedActivity);
    });
  });

  describe('toggleComplete', () => {
    it('should toggle activity completion status', async () => {
      const toggledActivity = {
        id: 'activity-123',
        subject: 'Follow-up call',
        isCompleted: true,
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'activity-123' };
      mockActivityService.toggleComplete.mockResolvedValue(toggledActivity);

      await ActivityController.toggleComplete(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.toggleComplete).toHaveBeenCalledWith('activity-123', 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(toggledActivity);
    });
  });

  describe('delete', () => {
    it('should delete activity and return 204', async () => {
      mockReq.params = { id: 'activity-123' };

      await ActivityController.delete(mockReq as AuthRequest, mockRes as Response);

      expect(mockActivityService.delete).toHaveBeenCalledWith('activity-123', 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });
  });
});
