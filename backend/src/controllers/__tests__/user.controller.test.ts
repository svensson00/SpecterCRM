import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { UserController } from '../user.controller';

const mockUserService = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  updateRole: vi.fn(),
  deactivate: vi.fn(),
  delete: vi.fn(),
  changeOwnPassword: vi.fn(),
  changeUserPassword: vi.fn(),
}));

vi.mock('../../services/user.service', () => ({
  UserService: mockUserService,
}));

describe('UserController', () => {
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
      user: { userId: 'user-123', tenantId: 'tenant-123', email: 'user@example.com', role: 'ADMIN' },
    };
  });

  describe('getAll', () => {
    it('should return paginated users', async () => {
      const paginatedResult = {
        data: [
          { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One', role: 'USER' },
          { id: 'user-2', email: 'user2@example.com', firstName: 'User', lastName: 'Two', role: 'USER' },
        ],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      };

      mockReq.query = { page: '1', limit: '20' };
      mockUserService.findAll.mockResolvedValue(paginatedResult);

      await UserController.getAll(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        page: 1,
        limit: 20,
        sortBy: undefined,
        sortOrder: 'desc',
      });
      expect(mockRes.json).toHaveBeenCalledWith(paginatedResult);
    });
  });

  describe('getById', () => {
    it('should return user by id', async () => {
      const user = {
        id: 'user-456',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
        isActive: true,
        tenantId: 'tenant-123',
      };

      mockReq.params = { id: 'user-456' };
      mockUserService.findById.mockResolvedValue(user);

      await UserController.getById(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.findById).toHaveBeenCalledWith('user-456', 'tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(user);
    });
  });

  describe('update', () => {
    it('should update user and return updated data', async () => {
      const updateData = { firstName: 'Jonathan', lastName: 'Doe', isActive: true };
      const updatedUser = {
        id: 'user-456',
        email: 'user@example.com',
        firstName: 'Jonathan',
        lastName: 'Doe',
        role: 'USER',
        isActive: true,
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'user-456' };
      mockReq.body = updateData;
      mockUserService.update.mockResolvedValue(updatedUser);

      await UserController.update(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.update).toHaveBeenCalledWith('user-456', updateData, 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(updatedUser);
    });
  });

  describe('updateRole', () => {
    it('should update user role and return updated data', async () => {
      const updatedUser = {
        id: 'user-456',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'ADMIN',
        isActive: true,
        tenantId: 'tenant-123',
        updatedAt: new Date(),
      };

      mockReq.params = { id: 'user-456' };
      mockReq.body = { role: 'ADMIN' };
      mockUserService.updateRole.mockResolvedValue(updatedUser);

      await UserController.updateRole(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.updateRole).toHaveBeenCalledWith('user-456', 'ADMIN', 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith(updatedUser);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user and return 204', async () => {
      mockReq.params = { id: 'user-456' };

      await UserController.deactivate(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.deactivate).toHaveBeenCalledWith('user-456', 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete user and return 204', async () => {
      mockReq.params = { id: 'user-456' };

      await UserController.delete(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.delete).toHaveBeenCalledWith('user-456', 'tenant-123', 'user-123');
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('changeOwnPassword', () => {
    it('should change own password and return success message', async () => {
      mockReq.body = { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' };

      await UserController.changeOwnPassword(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.changeOwnPassword).toHaveBeenCalledWith(
        'user-123',
        'tenant-123',
        'OldPassword123!',
        'NewPassword123!'
      );
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
    });
  });

  describe('changeUserPassword', () => {
    it('should change user password and return success message', async () => {
      mockReq.params = { id: 'user-456' };
      mockReq.body = { newPassword: 'NewPassword123!' };

      await UserController.changeUserPassword(mockReq as AuthRequest, mockRes as Response);

      expect(mockUserService.changeUserPassword).toHaveBeenCalledWith(
        'user-456',
        'tenant-123',
        'NewPassword123!',
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
    });
  });
});
