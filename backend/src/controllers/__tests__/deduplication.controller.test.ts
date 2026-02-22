import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { DeduplicationController } from '../deduplication.controller';

const mockDeduplicationService = vi.hoisted(() => ({
  detectOrganizationDuplicates: vi.fn(),
  detectContactDuplicates: vi.fn(),
  getSuggestions: vi.fn(),
  merge: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('../../services/deduplication.service', () => ({
  DeduplicationService: mockDeduplicationService,
}));

describe('DeduplicationController', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
    mockReq = {
      user: { userId: 'user-123', tenantId: 'tenant-123', email: 'user@example.com', role: 'ADMIN' },
    };
  });

  describe('detectOrganizations', () => {
    it('should detect organization duplicates and return results', async () => {
      const detectionResults = {
        suggestionsCreated: 5,
        duplicatesFound: 10,
      };

      mockDeduplicationService.detectOrganizationDuplicates.mockResolvedValue(detectionResults);

      await DeduplicationController.detectOrganizations(mockReq as AuthRequest, mockRes as Response);

      expect(mockDeduplicationService.detectOrganizationDuplicates).toHaveBeenCalledWith('tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(detectionResults);
    });
  });

  describe('detectContacts', () => {
    it('should detect contact duplicates and return results', async () => {
      const detectionResults = {
        suggestionsCreated: 3,
        duplicatesFound: 6,
      };

      mockDeduplicationService.detectContactDuplicates.mockResolvedValue(detectionResults);

      await DeduplicationController.detectContacts(mockReq as AuthRequest, mockRes as Response);

      expect(mockDeduplicationService.detectContactDuplicates).toHaveBeenCalledWith('tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(detectionResults);
    });
  });

  describe('getSuggestions', () => {
    it('should return 400 when entityType is missing', async () => {
      mockReq.query = {};

      await DeduplicationController.getSuggestions(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid entityType' });
      expect(mockDeduplicationService.getSuggestions).not.toHaveBeenCalled();
    });

    it('should return 400 when entityType is invalid', async () => {
      mockReq.query = { entityType: 'INVALID' };

      await DeduplicationController.getSuggestions(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid entityType' });
      expect(mockDeduplicationService.getSuggestions).not.toHaveBeenCalled();
    });

    it('should return organization suggestions', async () => {
      const suggestions = [
        {
          id: 'suggestion-1',
          entityType: 'ORGANIZATION',
          entity1Id: 'org-1',
          entity2Id: 'org-2',
          similarity: 0.95,
          status: 'PENDING',
        },
      ];

      mockReq.query = { entityType: 'ORGANIZATION' };
      mockDeduplicationService.getSuggestions.mockResolvedValue(suggestions);

      await DeduplicationController.getSuggestions(mockReq as AuthRequest, mockRes as Response);

      expect(mockDeduplicationService.getSuggestions).toHaveBeenCalledWith('tenant-123', 'ORGANIZATION');
      expect(mockRes.json).toHaveBeenCalledWith(suggestions);
    });

    it('should return contact suggestions', async () => {
      const suggestions = [
        {
          id: 'suggestion-2',
          entityType: 'CONTACT',
          entity1Id: 'contact-1',
          entity2Id: 'contact-2',
          similarity: 0.88,
          status: 'PENDING',
        },
      ];

      mockReq.query = { entityType: 'CONTACT' };
      mockDeduplicationService.getSuggestions.mockResolvedValue(suggestions);

      await DeduplicationController.getSuggestions(mockReq as AuthRequest, mockRes as Response);

      expect(mockDeduplicationService.getSuggestions).toHaveBeenCalledWith('tenant-123', 'CONTACT');
      expect(mockRes.json).toHaveBeenCalledWith(suggestions);
    });
  });

  describe('merge', () => {
    it('should return 400 when suggestionId is missing', async () => {
      mockReq.body = { primaryId: 'org-1' };

      await DeduplicationController.merge(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'suggestionId and primaryId are required' });
      expect(mockDeduplicationService.merge).not.toHaveBeenCalled();
    });

    it('should return 400 when primaryId is missing', async () => {
      mockReq.body = { suggestionId: 'suggestion-1' };

      await DeduplicationController.merge(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'suggestionId and primaryId are required' });
      expect(mockDeduplicationService.merge).not.toHaveBeenCalled();
    });

    it('should merge duplicates and return success message', async () => {
      mockReq.body = { suggestionId: 'suggestion-1', primaryId: 'org-1' };

      await DeduplicationController.merge(mockReq as AuthRequest, mockRes as Response);

      expect(mockDeduplicationService.merge).toHaveBeenCalledWith(
        'suggestion-1',
        'org-1',
        'tenant-123',
        'user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Records merged successfully' });
    });
  });

  describe('dismiss', () => {
    it('should return 400 when suggestionId is missing', async () => {
      mockReq.body = {};

      await DeduplicationController.dismiss(mockReq as AuthRequest, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'suggestionId is required' });
      expect(mockDeduplicationService.dismiss).not.toHaveBeenCalled();
    });

    it('should dismiss suggestion and return success message', async () => {
      mockReq.body = { suggestionId: 'suggestion-1' };

      await DeduplicationController.dismiss(mockReq as AuthRequest, mockRes as Response);

      expect(mockDeduplicationService.dismiss).toHaveBeenCalledWith('suggestion-1', 'tenant-123', 'user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Suggestion dismissed' });
    });
  });
});
