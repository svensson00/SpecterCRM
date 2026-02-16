import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JWTPayload } from '../../utils/auth';
import { ReportService } from '../../services/report.service';

export function registerReportTools(server: McpServer, auth: JWTPayload, wrapToolHandler: any) {
  server.tool(
    'get_pipeline_report',
    'Get pipeline summary report (count and total value by stage)',
    {},
    wrapToolHandler(async () => {
      return ReportService.getPipelineSummary(auth.tenantId);
    })
  );

  server.tool(
    'get_win_rate_report',
    'Get win rate report (won vs lost deals, average deal size)',
    {},
    wrapToolHandler(async () => {
      return ReportService.getWinRate(auth.tenantId);
    })
  );

  server.tool(
    'get_cycle_time_report',
    'Get cycle time report (average and median days from creation to close)',
    {},
    wrapToolHandler(async () => {
      return ReportService.getCycleTime(auth.tenantId);
    })
  );

  server.tool(
    'get_activity_volume_report',
    'Get activity volume report (count and completion rate by activity type)',
    {
      startDate: z.string().optional().describe('Start date (ISO format)'),
      endDate: z.string().optional().describe('End date (ISO format)'),
    },
    wrapToolHandler(async (params: any) => {
      const startDate = params.startDate ? new Date(params.startDate) : undefined;
      const endDate = params.endDate ? new Date(params.endDate) : undefined;
      return ReportService.getActivityVolume(auth.tenantId, startDate, endDate);
    })
  );

  server.tool(
    'get_top_accounts_report',
    'Get top accounts report (organizations with highest total revenue)',
    {
      limit: z.number().optional().describe('Number of top accounts to return (default: 10)'),
    },
    wrapToolHandler(async (params: any) => {
      return ReportService.getTopAccounts(auth.tenantId, params.limit);
    })
  );

  server.tool(
    'get_forecast_report',
    'Get forecast report (projected revenue by month based on expected close dates and probabilities)',
    {},
    wrapToolHandler(async () => {
      return ReportService.getForecast(auth.tenantId);
    })
  );
}
