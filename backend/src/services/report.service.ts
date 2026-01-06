import prisma from '../config/database';

export class ReportService {
  static async getPipelineSummary(tenantId: string) {
    const deals = await prisma.deal.groupBy({
      by: ['stage'],
      where: { tenantId },
      _count: { _all: true },
      _sum: { amount: true },
    });

    const stages = ['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST'];

    return stages.map((stage) => {
      const data = deals.find((d) => d.stage === stage);
      const count = data?._count._all || 0;
      const totalValue = data?._sum.amount || 0;
      return {
        stage,
        count,
        totalValue,
        avgValue: count > 0 ? totalValue / count : 0,
      };
    });
  }

  static async getWinRate(tenantId: string) {
    const [won, lost, wonDeals] = await Promise.all([
      prisma.deal.count({ where: { tenantId, stage: 'WON' } }),
      prisma.deal.count({ where: { tenantId, stage: 'LOST' } }),
      prisma.deal.findMany({
        where: { tenantId, stage: 'WON' },
        select: { amount: true }
      }),
    ]);

    const total = won + lost;
    const winRate = total > 0 ? won / total : 0;
    const totalRevenue = wonDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
    const avgDealSize = won > 0 ? totalRevenue / won : 0;

    return {
      totalDeals: total,
      wonDeals: won,
      lostDeals: lost,
      winRate,
      avgDealSize
    };
  }

  static async getCycleTime(tenantId: string) {
    const closedDeals = await prisma.deal.findMany({
      where: {
        tenantId,
        OR: [{ stage: 'WON' }, { stage: 'LOST' }],
      },
      select: {
        createdAt: true,
        updatedAt: true,
        stage: true,
      },
    });

    if (closedDeals.length === 0) {
      return { avgCycleTime: 0, medianCycleTime: 0 };
    }

    const cycleTimes = closedDeals.map((deal) => {
      return Math.floor(
        (deal.updatedAt.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
    });

    const avgCycleTime = cycleTimes.reduce((sum, days) => sum + days, 0) / cycleTimes.length;

    // Calculate median
    const sorted = [...cycleTimes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianCycleTime = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    return {
      avgCycleTime,
      medianCycleTime,
    };
  }

  static async getActivityVolume(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = { tenantId };

    if (startDate || endDate) {
      where.dueAt = {};
      if (startDate) where.dueAt.gte = startDate;
      if (endDate) where.dueAt.lte = endDate;
    }

    const [byType, completedByType] = await Promise.all([
      prisma.activity.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      }),
      prisma.activity.groupBy({
        by: ['type'],
        where: { ...where, isCompleted: true },
        _count: { _all: true },
      }),
    ]);

    return byType.map((t) => {
      const completedData = completedByType.find((c) => c.type === t.type);
      const count = t._count._all;
      const completed = completedData?._count._all || 0;
      return {
        type: t.type,
        count,
        completed,
        completionRate: count > 0 ? completed / count : 0,
      };
    });
  }

  static async getTopAccounts(tenantId: string, limit = 10) {
    const organizations = await prisma.organization.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        deals: {
          where: { stage: 'WON' },
          select: { amount: true },
        },
      },
    });

    const topAccounts = organizations
      .map((org) => {
        const totalRevenue = org.deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
        const dealCount = org.deals.length;
        return {
          organizationId: org.id,
          organizationName: org.name,
          totalRevenue,
          dealCount,
          avgDealSize: dealCount > 0 ? totalRevenue / dealCount : 0,
        };
      })
      .filter((org) => org.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return topAccounts;
  }

  static async getForecast(tenantId: string) {
    const deals = await prisma.deal.findMany({
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

    const forecast = deals.reduce((acc, deal) => {
      if (!deal.expectedCloseDate || !deal.amount) return acc;

      const month = deal.expectedCloseDate.toISOString().substring(0, 7);
      const weightedValue = deal.amount * ((deal.probability || 50) / 100);

      if (!acc[month]) {
        acc[month] = { month, totalValue: 0, weightedValue: 0, dealCount: 0 };
      }

      acc[month].totalValue += deal.amount;
      acc[month].weightedValue += weightedValue;
      acc[month].dealCount += 1;

      return acc;
    }, {} as Record<string, { month: string; totalValue: number; weightedValue: number; dealCount: number }>);

    return Object.values(forecast).sort((a, b) => a.month.localeCompare(b.month));
  }
}
