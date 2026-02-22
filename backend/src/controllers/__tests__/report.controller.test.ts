import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ReportController } from '../report.controller';

const mockReportService = vi.hoisted(() => ({
  getPipelineSummary: vi.fn(),
  getWinRate: vi.fn(),
  getCycleTime: vi.fn(),
  getActivityVolume: vi.fn(),
  getTopAccounts: vi.fn(),
  getForecast: vi.fn(),
}));

vi.mock('../../services/report.service', () => ({
  ReportService: mockReportService,
}));

describe('ReportController', () => {
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
      user: { userId: 'user-123', tenantId: 'tenant-123', email: 'user@example.com', role: 'USER' },
      query: {},
    };
  });

  describe('getPipeline', () => {
    it('should return pipeline summary', async () => {
      const pipelineSummary = [
        { stage: 'LEAD', count: 5, totalAmount: 25000, avgProbability: 20 },
        { stage: 'PROSPECT', count: 3, totalAmount: 45000, avgProbability: 40 },
        { stage: 'QUOTE', count: 2, totalAmount: 60000, avgProbability: 70 },
        { stage: 'WON', count: 1, totalAmount: 50000, avgProbability: 100 },
        { stage: 'LOST', count: 1, totalAmount: 10000, avgProbability: 0 },
      ];

      mockReportService.getPipelineSummary.mockResolvedValue(pipelineSummary);

      await ReportController.getPipeline(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getPipelineSummary).toHaveBeenCalledWith('tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(pipelineSummary);
    });
  });

  describe('getWinRate', () => {
    it('should return win rate data', async () => {
      const winRate = {
        totalDeals: 20,
        wonDeals: 12,
        lostDeals: 8,
        winRate: 60,
      };

      mockReportService.getWinRate.mockResolvedValue(winRate);

      await ReportController.getWinRate(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getWinRate).toHaveBeenCalledWith('tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(winRate);
    });
  });

  describe('getCycleTime', () => {
    it('should return cycle time data', async () => {
      const cycleTime = {
        averageDays: 45,
        medianDays: 42,
        byStage: {
          LEAD: 10,
          PROSPECT: 15,
          QUOTE: 20,
        },
      };

      mockReportService.getCycleTime.mockResolvedValue(cycleTime);

      await ReportController.getCycleTime(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getCycleTime).toHaveBeenCalledWith('tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(cycleTime);
    });
  });

  describe('getActivityVolume', () => {
    it('should return activity volume without date filters', async () => {
      const volumeData = [
        { date: '2026-02-01', count: 5, completed: 3 },
        { date: '2026-02-02', count: 7, completed: 5 },
        { date: '2026-02-03', count: 4, completed: 2 },
      ];

      mockReportService.getActivityVolume.mockResolvedValue(volumeData);

      await ReportController.getActivityVolume(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getActivityVolume).toHaveBeenCalledWith('tenant-123', undefined, undefined);
      expect(mockRes.json).toHaveBeenCalledWith(volumeData);
    });

    it('should return activity volume with date filters', async () => {
      const volumeData = [
        { date: '2026-02-01', count: 5, completed: 3 },
        { date: '2026-02-02', count: 7, completed: 5 },
      ];

      mockReq.query = { startDate: '2026-02-01', endDate: '2026-02-02' };
      mockReportService.getActivityVolume.mockResolvedValue(volumeData);

      await ReportController.getActivityVolume(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getActivityVolume).toHaveBeenCalledWith(
        'tenant-123',
        new Date('2026-02-01'),
        new Date('2026-02-02')
      );
      expect(mockRes.json).toHaveBeenCalledWith(volumeData);
    });
  });

  describe('getTopAccounts', () => {
    it('should return top 10 accounts by default', async () => {
      const topAccounts = [
        { organizationId: 'org-1', organizationName: 'Acme Corp', totalAmount: 500000, dealCount: 5 },
        { organizationId: 'org-2', organizationName: 'Beta Inc', totalAmount: 300000, dealCount: 3 },
      ];

      mockReportService.getTopAccounts.mockResolvedValue(topAccounts);

      await ReportController.getTopAccounts(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getTopAccounts).toHaveBeenCalledWith('tenant-123', 10);
      expect(mockRes.json).toHaveBeenCalledWith(topAccounts);
    });

    it('should return custom limit of top accounts', async () => {
      const topAccounts = [
        { organizationId: 'org-1', organizationName: 'Acme Corp', totalAmount: 500000, dealCount: 5 },
      ];

      mockReq.query = { limit: '5' };
      mockReportService.getTopAccounts.mockResolvedValue(topAccounts);

      await ReportController.getTopAccounts(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getTopAccounts).toHaveBeenCalledWith('tenant-123', 5);
      expect(mockRes.json).toHaveBeenCalledWith(topAccounts);
    });
  });

  describe('getForecast', () => {
    it('should return forecast data', async () => {
      const forecastData = {
        currentQuarter: {
          total: 1500000,
          weighted: 850000,
        },
        nextQuarter: {
          total: 1200000,
          weighted: 600000,
        },
        byStage: {
          LEAD: 250000,
          PROSPECT: 400000,
          QUOTE: 550000,
        },
      };

      mockReportService.getForecast.mockResolvedValue(forecastData);

      await ReportController.getForecast(mockReq as AuthRequest, mockRes as Response);

      expect(mockReportService.getForecast).toHaveBeenCalledWith('tenant-123');
      expect(mockRes.json).toHaveBeenCalledWith(forecastData);
    });
  });
});
