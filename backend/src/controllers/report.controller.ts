import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ReportService } from '../services/report.service';

export class ReportController {
  static async getPipeline(req: AuthRequest, res: Response) {
    const pipeline = await ReportService.getPipelineSummary(req.user!.tenantId);
    res.json(pipeline);
  }

  static async getWinRate(req: AuthRequest, res: Response) {
    const winRate = await ReportService.getWinRate(req.user!.tenantId);
    res.json(winRate);
  }

  static async getCycleTime(req: AuthRequest, res: Response) {
    const cycleTime = await ReportService.getCycleTime(req.user!.tenantId);
    res.json(cycleTime);
  }

  static async getActivityVolume(req: AuthRequest, res: Response) {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const volume = await ReportService.getActivityVolume(req.user!.tenantId, startDate, endDate);
    res.json(volume);
  }

  static async getTopAccounts(req: AuthRequest, res: Response) {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const topAccounts = await ReportService.getTopAccounts(req.user!.tenantId, limit);
    res.json(topAccounts);
  }

  static async getForecast(req: AuthRequest, res: Response) {
    const forecast = await ReportService.getForecast(req.user!.tenantId);
    res.json(forecast);
  }
}
