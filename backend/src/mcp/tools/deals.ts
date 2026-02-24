import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JWTPayload } from '../../utils/auth';
import { DealService } from '../../services/deal.service';
import { DealStage } from '@prisma/client';

export function registerDealTools(server: McpServer, auth: JWTPayload, wrapToolHandler: any) {
  server.tool(
    'list_deals',
    'List all deals with optional filtering, search, and pagination',
    {
      search: z.string().optional().describe('Search by title or organization name'),
      stage: z.enum(['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST']).optional().describe('Filter by deal stage'),
      ownerUserId: z.string().optional().describe('Filter by owner user ID'),
      organizationId: z.string().optional().describe('Filter by organization ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
      sortBy: z.string().optional().describe('Sort field (default: createdAt)'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (default: desc)'),
    },
    wrapToolHandler(async (params: any) => {
      return DealService.findAll({
        tenantId: auth.tenantId,
        search: params.search,
        stage: params.stage as DealStage | undefined,
        ownerUserId: params.ownerUserId,
        organizationId: params.organizationId,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });
    })
  );

  server.tool(
    'get_deal',
    'Get detailed information about a specific deal by ID',
    {
      id: z.string().describe('Deal ID'),
    },
    wrapToolHandler(async (params: any) => {
      return DealService.findById(params.id, auth.tenantId);
    })
  );

  server.tool(
    'create_deal',
    'Create a new deal (consulting engagement)',
    {
      title: z.string().describe('Deal title (required)'),
      organizationId: z.string().describe('Organization ID (required)'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs associated with this deal'),
      amount: z.number().optional().describe('Deal amount'),
      expectedCloseDate: z.string().optional().describe('Expected close date (ISO format)'),
      stage: z.enum(['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST']).optional().describe('Deal stage (default: LEAD)'),
      probability: z.number().optional().describe('Win probability (0-100)'),
      ownerUserId: z.string().optional().describe('Owner user ID (defaults to current user)'),
    },
    wrapToolHandler(async (params: any) => {
      return DealService.create(
        {
          title: params.title,
          organizationId: params.organizationId,
          contactIds: params.contactIds,
          amount: params.amount,
          expectedCloseDate: params.expectedCloseDate,
          stage: params.stage as DealStage | undefined,
          probability: params.probability,
          ownerUserId: params.ownerUserId,
        },
        auth.tenantId,
        auth.userId
      );
    })
  );

  server.tool(
    'update_deal',
    'Update an existing deal',
    {
      id: z.string().describe('Deal ID'),
      title: z.string().optional().describe('Deal title'),
      organizationId: z.string().optional().describe('Organization ID'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs'),
      amount: z.number().optional().describe('Deal amount'),
      currency: z.string().optional().describe('Currency code'),
      expectedCloseDate: z.string().optional().describe('Expected close date (ISO format)'),
      stage: z.enum(['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST']).optional().describe('Deal stage'),
      probability: z.number().optional().describe('Win probability (0-100)'),
      reasonLost: z.string().optional().describe('Reason for loss (required if stage is LOST)'),
      ownerUserId: z.string().optional().describe('Owner user ID'),
    },
    wrapToolHandler(async (params: any) => {
      const { id, ...data } = params;
      return DealService.update(
        id,
        {
          ...data,
          stage: data.stage as DealStage | undefined,
        },
        auth.tenantId,
        auth.userId
      );
    })
  );

  server.tool(
    'update_deal_stage',
    'Update the stage of a deal (move through pipeline)',
    {
      id: z.string().describe('Deal ID'),
      stage: z.enum(['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST']).describe('New stage'),
      reasonLost: z.string().optional().describe('Reason for loss (required if stage is LOST)'),
    },
    wrapToolHandler(async (params: any) => {
      return DealService.updateStage(
        params.id,
        params.stage as DealStage,
        params.reasonLost,
        auth.tenantId,
        auth.userId
      );
    })
  );

  server.tool(
    'delete_deal',
    'Delete a deal',
    {
      id: z.string().describe('Deal ID'),
    },
    wrapToolHandler(async (params: any) => {
      await DealService.delete(params.id, auth.tenantId, auth.userId);
      return { success: true, message: 'Deal deleted successfully' };
    })
  );
}
