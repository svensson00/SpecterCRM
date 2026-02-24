import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService } from '../report.service';

const mockPrisma = vi.hoisted(() => ({
  deal: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  activity: {
    groupBy: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));

describe('ReportService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPipelineSummary', () => {
    it('should return pipeline metrics grouped by stage', async () => {
      const mockGroupedDeals = [
        { stage: 'LEAD', _count: { _all: 2 }, _sum: { amount: 30000 } },
        { stage: 'PROSPECT', _count: { _all: 1 }, _sum: { amount: 30000 } },
        { stage: 'QUOTE', _count: { _all: 1 }, _sum: { amount: 40000 } },
        { stage: 'WON', _count: { _all: 1 }, _sum: { amount: 50000 } },
        { stage: 'LOST', _count: { _all: 1 }, _sum: { amount: 15000 } },
      ];

      mockPrisma.deal.groupBy.mockResolvedValue(mockGroupedDeals);

      const result = await ReportService.getPipelineSummary(tenantId);

      expect(mockPrisma.deal.groupBy).toHaveBeenCalledWith({
        by: ['stage'],
        where: { tenantId },
        _count: { _all: true },
        _sum: { amount: true },
      });

      expect(result).toHaveLength(5);
      expect(result.find(r => r.stage === 'LEAD')).toEqual({
        stage: 'LEAD',
        count: 2,
        totalValue: 30000,
        avgValue: 15000,
      });
      expect(result.find(r => r.stage === 'WON')).toEqual({
        stage: 'WON',
        count: 1,
        totalValue: 50000,
        avgValue: 50000,
      });
    });
  });

  describe('getWinRate', () => {
    it('should calculate win rate correctly', async () => {
      mockPrisma.deal.count
        .mockResolvedValueOnce(3) // WON
        .mockResolvedValueOnce(1);  // LOST

      mockPrisma.deal.findMany.mockResolvedValue([
        { amount: 10000 },
        { amount: 20000 },
        { amount: 15000 },
      ]);

      const result = await ReportService.getWinRate(tenantId);

      expect(result.totalDeals).toBe(4);
      expect(result.wonDeals).toBe(3);
      expect(result.lostDeals).toBe(1);
      expect(result.winRate).toBe(0.75);
      expect(result.avgDealSize).toBe(15000); // 45000 / 3 = 15000
    });

    it('should return 0 win rate when no deals exist', async () => {
      mockPrisma.deal.count
        .mockResolvedValueOnce(0) // WON
        .mockResolvedValueOnce(0);  // LOST

      mockPrisma.deal.findMany.mockResolvedValue([]);

      const result = await ReportService.getWinRate(tenantId);

      expect(result.totalDeals).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.avgDealSize).toBe(0);
    });
  });

  describe('getCycleTime (issue #23)', () => {
    it('should use closedAt instead of updatedAt for cycle time calculation', async () => {
      const now = new Date('2025-02-20T12:00:00Z');
      const createdAt = new Date('2025-01-01T12:00:00Z');

      const mockDeals = [
        {
          createdAt,
          closedAt: now,
          stage: 'WON',
        },
      ];

      mockPrisma.deal.findMany.mockResolvedValue(mockDeals);

      const result = await ReportService.getCycleTime(tenantId);

      // Verify the query uses closedAt
      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            closedAt: { not: null },
          }),
          select: expect.objectContaining({
            closedAt: true,
          }),
        })
      );

      // Expected cycle time: 50 days (Feb 20 - Jan 1)
      expect(result.avgCycleTime).toBe(50);
      expect(result.medianCycleTime).toBe(50);
    });

    it('should calculate median correctly for multiple deals', async () => {
      const now = new Date('2025-02-01T12:00:00Z');

      const mockDeals = [
        {
          createdAt: new Date('2025-01-01T12:00:00Z'),
          closedAt: new Date('2025-01-11T12:00:00Z'), // 10 days
          stage: 'WON',
        },
        {
          createdAt: new Date('2025-01-01T12:00:00Z'),
          closedAt: new Date('2025-01-21T12:00:00Z'), // 20 days
          stage: 'WON',
        },
        {
          createdAt: new Date('2025-01-01T12:00:00Z'),
          closedAt: new Date('2025-02-01T12:00:00Z'), // 31 days
          stage: 'LOST',
        },
      ];

      mockPrisma.deal.findMany.mockResolvedValue(mockDeals);

      const result = await ReportService.getCycleTime(tenantId);

      expect(result.avgCycleTime).toBeCloseTo(20.33, 1);
      expect(result.medianCycleTime).toBe(20);
    });

    it('should return 0 when no closed deals exist', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);

      const result = await ReportService.getCycleTime(tenantId);

      expect(result.avgCycleTime).toBe(0);
      expect(result.medianCycleTime).toBe(0);
    });

    it('should filter by closedAt not null', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);

      await ReportService.getCycleTime(tenantId);

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            OR: [{ stage: 'WON' }, { stage: 'LOST' }],
            closedAt: { not: null },
          }),
        })
      );
    });
  });

  describe('getTopAccounts (issue #27)', () => {
    it('should use raw SQL with GROUP BY instead of loading all orgs', async () => {
      const mockResults = [
        {
          organization_id: 'org-1',
          organization_name: 'SVT',
          total_revenue: 500000,
          deal_count: BigInt(5),
        },
        {
          organization_id: 'org-2',
          organization_name: 'YLE',
          total_revenue: 300000,
          deal_count: BigInt(3),
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockResults);

      const result = await ReportService.getTopAccounts(tenantId, 10);

      // Verify raw SQL query is used
      expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();

      // Verify GROUP BY pattern in the query
      const callArgs = mockPrisma.$queryRaw.mock.calls[0];
      const query = callArgs[0].join('');
      expect(query).toContain('GROUP BY');
      expect(query).toContain('organization_id');
      expect(query).toContain('total_revenue');
      expect(query).toContain('deal_count');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        organizationId: 'org-1',
        organizationName: 'SVT',
        totalRevenue: 500000,
        dealCount: 5,
        avgDealSize: 100000,
      });
      expect(result[1]).toEqual({
        organizationId: 'org-2',
        organizationName: 'YLE',
        totalRevenue: 300000,
        dealCount: 3,
        avgDealSize: 100000,
      });
    });

    it('should apply limit parameter', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await ReportService.getTopAccounts(tenantId, 5);

      const callArgs = mockPrisma.$queryRaw.mock.calls[0];
      const query = callArgs[0].join('');
      expect(query).toContain('LIMIT');
    });

    it('should filter by tenantId', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await ReportService.getTopAccounts(tenantId);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        tenantId,
        expect.anything()
      );
    });

    it('should only include WON deals', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await ReportService.getTopAccounts(tenantId);

      const callArgs = mockPrisma.$queryRaw.mock.calls[0];
      const query = callArgs[0].join('');
      expect(query).toContain("stage = 'WON'");
    });

    it('should handle zero deal count correctly', async () => {
      const mockResults = [
        {
          organization_id: 'org-1',
          organization_name: 'Test Org',
          total_revenue: 0,
          deal_count: BigInt(0),
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockResults);

      const result = await ReportService.getTopAccounts(tenantId);

      expect(result[0].avgDealSize).toBe(0);
    });
  });

  describe('getActivityVolume', () => {
    it('should aggregate activities by type', async () => {
      const mockByType = [
        { type: 'Workshop', _count: { _all: 10 } },
        { type: 'POC Demo', _count: { _all: 5 } },
      ];

      const mockCompletedByType = [
        { type: 'Workshop', _count: { _all: 7 } },
        { type: 'POC Demo', _count: { _all: 3 } },
      ];

      mockPrisma.activity.groupBy
        .mockResolvedValueOnce(mockByType)
        .mockResolvedValueOnce(mockCompletedByType);

      const result = await ReportService.getActivityVolume(tenantId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'Workshop',
        count: 10,
        completed: 7,
        completionRate: 0.7,
      });
      expect(result[1]).toEqual({
        type: 'POC Demo',
        count: 5,
        completed: 3,
        completionRate: 0.6,
      });
    });

    it('should handle date range filters', async () => {
      mockPrisma.activity.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await ReportService.getActivityVolume(tenantId, startDate, endDate);

      expect(mockPrisma.activity.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            dueAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });

  describe('getForecast', () => {
    it('should calculate weighted forecast by month', async () => {
      const mockDeals = [
        {
          amount: 100000,
          probability: 80,
          expectedCloseDate: new Date('2025-03-15'),
        },
        {
          amount: 50000,
          probability: 50,
          expectedCloseDate: new Date('2025-03-20'),
        },
        {
          amount: 75000,
          probability: 60,
          expectedCloseDate: new Date('2025-04-10'),
        },
      ];

      mockPrisma.deal.findMany.mockResolvedValue(mockDeals);

      const result = await ReportService.getForecast(tenantId);

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          stage: { in: ['LEAD', 'PROSPECT', 'QUOTE'] },
          expectedCloseDate: { not: null },
        },
        select: {
          amount: true,
          probability: true,
          expectedCloseDate: true,
        },
      });

      expect(result).toHaveLength(2);

      const marchForecast = result.find(f => f.month === '2025-03');
      expect(marchForecast).toBeDefined();
      expect(marchForecast!.totalValue).toBe(150000);
      expect(marchForecast!.weightedValue).toBe(105000); // 80000 + 25000
      expect(marchForecast!.dealCount).toBe(2);

      const aprilForecast = result.find(f => f.month === '2025-04');
      expect(aprilForecast).toBeDefined();
      expect(aprilForecast!.totalValue).toBe(75000);
      expect(aprilForecast!.weightedValue).toBe(45000); // 75000 * 0.6
      expect(aprilForecast!.dealCount).toBe(1);
    });

    it('should only include open pipeline stages', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);

      await ReportService.getForecast(tenantId);

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stage: { in: ['LEAD', 'PROSPECT', 'QUOTE'] },
          }),
        })
      );
    });
  });
});
