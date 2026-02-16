import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JWTPayload } from '../../utils/auth';
import { ContactService } from '../../services/contact.service';

export function registerContactTools(server: McpServer, auth: JWTPayload, wrapToolHandler: any) {
  server.tool(
    'list_contacts',
    'List all contacts with optional filtering, search, and pagination',
    {
      search: z.string().optional().describe('Search by name or email'),
      ownerUserId: z.string().optional().describe('Filter by owner user ID'),
      organizationId: z.string().optional().describe('Filter by organization ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
      sortBy: z.string().optional().describe('Sort field (default: createdAt)'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (default: desc)'),
    },
    wrapToolHandler(async (params: any) => {
      return ContactService.findAll({
        tenantId: auth.tenantId,
        search: params.search,
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
    'get_contact',
    'Get detailed information about a specific contact by ID',
    {
      id: z.string().describe('Contact ID'),
    },
    wrapToolHandler(async (params: any) => {
      return ContactService.findById(params.id, auth.tenantId);
    })
  );

  server.tool(
    'create_contact',
    'Create a new contact',
    {
      firstName: z.string().describe('First name (required)'),
      lastName: z.string().describe('Last name (required)'),
      jobTitle: z.string().optional().describe('Job title'),
      contactRole: z.string().optional().describe('Contact role (e.g., CTO, Head of Streaming)'),
      primaryOrganizationId: z.string().describe('Primary organization ID (required)'),
      ownerUserId: z.string().optional().describe('Owner user ID (defaults to current user)'),
      emails: z.array(z.object({
        email: z.string().describe('Email address'),
        isPrimary: z.boolean().describe('Is this the primary email'),
      })).describe('Email addresses (at least one required)'),
      phones: z.array(z.object({
        phone: z.string().describe('Phone number'),
        type: z.string().optional().describe('Phone type (e.g., Mobile, Work)'),
        isPrimary: z.boolean().describe('Is this the primary phone'),
      })).optional().describe('Phone numbers'),
    },
    wrapToolHandler(async (params: any) => {
      return ContactService.create(
        {
          firstName: params.firstName,
          lastName: params.lastName,
          jobTitle: params.jobTitle,
          contactRole: params.contactRole,
          primaryOrganizationId: params.primaryOrganizationId,
          ownerUserId: params.ownerUserId,
          emails: params.emails,
          phones: params.phones,
        },
        auth.tenantId,
        auth.userId
      );
    })
  );

  server.tool(
    'update_contact',
    'Update an existing contact',
    {
      id: z.string().describe('Contact ID'),
      firstName: z.string().optional().describe('First name'),
      lastName: z.string().optional().describe('Last name'),
      jobTitle: z.string().optional().describe('Job title'),
      contactRole: z.string().optional().describe('Contact role'),
      primaryOrganizationId: z.string().optional().describe('Primary organization ID'),
      ownerUserId: z.string().optional().describe('Owner user ID'),
      emails: z.array(z.object({
        email: z.string().describe('Email address'),
        isPrimary: z.boolean().describe('Is this the primary email'),
      })).optional().describe('Email addresses'),
      phones: z.array(z.object({
        phone: z.string().describe('Phone number'),
        type: z.string().optional().describe('Phone type'),
        isPrimary: z.boolean().describe('Is this the primary phone'),
      })).optional().describe('Phone numbers'),
    },
    wrapToolHandler(async (params: any) => {
      const { id, ...data } = params;
      return ContactService.update(id, data, auth.tenantId, auth.userId);
    })
  );

  server.tool(
    'delete_contact',
    'Delete a contact',
    {
      id: z.string().describe('Contact ID'),
    },
    wrapToolHandler(async (params: any) => {
      await ContactService.delete(params.id, auth.tenantId, auth.userId);
      return { success: true, message: 'Contact deleted successfully' };
    })
  );

  server.tool(
    'get_contact_activities',
    'Get all activities associated with a contact',
    {
      contactId: z.string().describe('Contact ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 20)'),
      isCompleted: z.boolean().optional().describe('Filter by completion status'),
    },
    wrapToolHandler(async (params: any) => {
      return ContactService.getActivities(
        params.contactId,
        auth.tenantId,
        params.page,
        params.limit,
        params.isCompleted
      );
    })
  );
}
