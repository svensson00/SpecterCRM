import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JWTPayload } from '../../utils/auth';
import { ActivityService } from '../../services/activity.service';

export function registerActivityTools(server: McpServer, auth: JWTPayload, wrapToolHandler: any) {
  server.tool(
    'list_activities',
    'List all activities with optional filtering and pagination',
    {
      type: z.string().optional().describe('Filter by activity type (e.g., Workshop, POC Demo, Architecture Review)'),
      ownerUserId: z.string().optional().describe('Filter by owner user ID'),
      isCompleted: z.boolean().optional().describe('Filter by completion status'),
      startDate: z.string().optional().describe('Filter by start date (ISO format)'),
      endDate: z.string().optional().describe('Filter by end date (ISO format)'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
      sortBy: z.string().optional().describe('Sort field (default: dueAt)'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (default: asc)'),
    },
    wrapToolHandler(async (params: any) => {
      return ActivityService.findAll({
        tenantId: auth.tenantId,
        type: params.type,
        ownerUserId: params.ownerUserId,
        isCompleted: params.isCompleted,
        startDate: params.startDate,
        endDate: params.endDate,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });
    })
  );

  server.tool(
    'get_activity',
    'Get detailed information about a specific activity by ID',
    {
      id: z.string().describe('Activity ID'),
    },
    wrapToolHandler(async (params: any) => {
      return ActivityService.findById(params.id, auth.tenantId);
    })
  );

  server.tool(
    'create_activity',
    'Create a new activity (technical touchpoint, workshop, POC demo, etc.)',
    {
      type: z.string().describe('Activity type (required)'),
      subject: z.string().describe('Activity subject/title (required)'),
      description: z.string().optional().describe('Activity description'),
      dueAt: z.string().optional().describe('Due date/time (ISO format)'),
      relatedOrganizationId: z.string().optional().describe('Related organization ID'),
      organizationIds: z.array(z.string()).optional().describe('Additional organization IDs'),
      relatedDealId: z.string().optional().describe('Related deal ID'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs'),
      ownerUserId: z.string().optional().describe('Owner user ID (defaults to current user)'),
    },
    wrapToolHandler(async (params: any) => {
      return ActivityService.create(
        {
          type: params.type,
          subject: params.subject,
          description: params.description,
          dueAt: params.dueAt,
          relatedOrganizationId: params.relatedOrganizationId,
          organizationIds: params.organizationIds,
          relatedDealId: params.relatedDealId,
          contactIds: params.contactIds,
          ownerUserId: params.ownerUserId,
        },
        auth.tenantId,
        auth.userId
      );
    })
  );

  server.tool(
    'update_activity',
    'Update an existing activity',
    {
      id: z.string().describe('Activity ID'),
      type: z.string().optional().describe('Activity type'),
      subject: z.string().optional().describe('Activity subject/title'),
      description: z.string().optional().describe('Activity description'),
      dueAt: z.string().optional().describe('Due date/time (ISO format)'),
      relatedOrganizationId: z.string().optional().describe('Related organization ID'),
      organizationIds: z.array(z.string()).optional().describe('Additional organization IDs'),
      relatedDealId: z.string().optional().describe('Related deal ID'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs'),
      ownerUserId: z.string().optional().describe('Owner user ID'),
    },
    wrapToolHandler(async (params: any) => {
      const { id, ...data } = params;
      return ActivityService.update(id, data, auth.tenantId, auth.userId);
    })
  );

  server.tool(
    'toggle_activity_complete',
    'Toggle the completion status of an activity',
    {
      id: z.string().describe('Activity ID'),
    },
    wrapToolHandler(async (params: any) => {
      return ActivityService.toggleComplete(params.id, auth.tenantId, auth.userId);
    })
  );
}
