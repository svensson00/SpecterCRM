import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JWTPayload } from '../../utils/auth';
import { OrganizationService } from '../../services/organization.service';

export function registerOrganizationTools(server: McpServer, auth: JWTPayload, wrapToolHandler: any) {
  server.tool(
    'list_organizations',
    'List all organizations with optional filtering, search, and pagination',
    {
      search: z.string().optional().describe('Search by name, website, or city'),
      ownerUserId: z.string().optional().describe('Filter by owner user ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
      sortBy: z.string().optional().describe('Sort field (default: createdAt)'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (default: desc)'),
    },
    wrapToolHandler(async (params: any) => {
      return OrganizationService.findAll({
        tenantId: auth.tenantId,
        search: params.search,
        ownerUserId: params.ownerUserId,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });
    })
  );

  server.tool(
    'get_organization',
    'Get detailed information about a specific organization by ID',
    {
      id: z.string().describe('Organization ID'),
    },
    wrapToolHandler(async (params: any) => {
      return OrganizationService.findById(params.id, auth.tenantId);
    })
  );

  server.tool(
    'create_organization',
    'Create a new organization',
    {
      name: z.string().describe('Organization name (required)'),
      website: z.string().optional().describe('Website URL'),
      street: z.string().optional().describe('Street address'),
      city: z.string().optional().describe('City'),
      zip: z.string().optional().describe('ZIP code'),
      country: z.string().optional().describe('Country'),
      ownerUserId: z.string().optional().describe('Owner user ID (defaults to current user)'),
    },
    wrapToolHandler(async (params: any) => {
      return OrganizationService.create(
        {
          name: params.name,
          website: params.website,
          street: params.street,
          city: params.city,
          zip: params.zip,
          country: params.country,
          ownerUserId: params.ownerUserId,
        },
        auth.tenantId,
        auth.userId
      );
    })
  );

  server.tool(
    'update_organization',
    'Update an existing organization',
    {
      id: z.string().describe('Organization ID'),
      name: z.string().optional().describe('Organization name'),
      website: z.string().optional().describe('Website URL'),
      street: z.string().optional().describe('Street address'),
      city: z.string().optional().describe('City'),
      zip: z.string().optional().describe('ZIP code'),
      country: z.string().optional().describe('Country'),
      ownerUserId: z.string().optional().describe('Owner user ID'),
    },
    wrapToolHandler(async (params: any) => {
      const { id, ...data } = params;
      return OrganizationService.update(id, data, auth.tenantId, auth.userId);
    })
  );

  server.tool(
    'delete_organization',
    'Delete an organization',
    {
      id: z.string().describe('Organization ID'),
    },
    wrapToolHandler(async (params: any) => {
      await OrganizationService.delete(params.id, auth.tenantId, auth.userId);
      return { success: true, message: 'Organization deleted successfully' };
    })
  );

  server.tool(
    'get_organization_contacts',
    'Get all contacts associated with an organization',
    {
      organizationId: z.string().describe('Organization ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
    },
    wrapToolHandler(async (params: any) => {
      return OrganizationService.getContacts(
        params.organizationId,
        auth.tenantId,
        params.page,
        params.limit
      );
    })
  );

  server.tool(
    'get_organization_deals',
    'Get all deals associated with an organization',
    {
      organizationId: z.string().describe('Organization ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
    },
    wrapToolHandler(async (params: any) => {
      return OrganizationService.getDeals(
        params.organizationId,
        auth.tenantId,
        params.page,
        params.limit
      );
    })
  );

  server.tool(
    'get_organization_activities',
    'Get all activities associated with an organization',
    {
      organizationId: z.string().describe('Organization ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
      isCompleted: z.boolean().optional().describe('Filter by completion status'),
    },
    wrapToolHandler(async (params: any) => {
      return OrganizationService.getActivities(
        params.organizationId,
        auth.tenantId,
        params.page,
        params.limit,
        params.isCompleted
      );
    })
  );
}
