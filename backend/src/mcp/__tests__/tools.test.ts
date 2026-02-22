import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JWTPayload } from '../../utils/auth';

// Mock services
const mockPrisma = vi.hoisted(() => ({
  organization: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  contact: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  deal: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  activity: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  note: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
}));

vi.mock('../../config/database', () => ({ default: mockPrisma }));
vi.mock('../../services/audit.service', () => ({
  AuditService: { log: vi.fn() },
}));

import { registerOrganizationTools } from '../tools/organizations';
import { registerContactTools } from '../tools/contacts';
import { registerDealTools } from '../tools/deals';
import { registerActivityTools } from '../tools/activities';
import { registerNoteTools } from '../tools/notes';
import { registerReportTools } from '../tools/reports';

describe('MCP Tool Registrations', () => {
  const auth: JWTPayload = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@demo.com',
    role: 'ADMIN',
  };

  const mockServer = {
    tool: vi.fn(),
  };

  const wrapToolHandler = (handler: any) => handler;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Organization Tools', () => {
    it('should register list_organizations tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'list_organizations',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_organization tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_organization',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register create_organization tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'create_organization',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register update_organization tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'update_organization',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register delete_organization tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'delete_organization',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_organization_contacts tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_organization_contacts',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_organization_deals tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_organization_deals',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_organization_activities tool', () => {
      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_organization_activities',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('list_organizations handler should call OrganizationService with tenantId', async () => {
      const mockOrgs = [{ id: 'org-1', name: 'SVT', tenantId: auth.tenantId }];
      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);
      mockPrisma.organization.count.mockResolvedValue(1);

      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      const listHandler = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'list_organizations'
      )[3];

      const result = await listHandler({ search: 'SVT' });

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: auth.tenantId,
          }),
        })
      );
      expect(result).toHaveProperty('data');
    });
  });

  describe('Contact Tools', () => {
    it('should register list_contacts tool', () => {
      registerContactTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'list_contacts',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_contact tool', () => {
      registerContactTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_contact',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register create_contact tool', () => {
      registerContactTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'create_contact',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register update_contact tool', () => {
      registerContactTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'update_contact',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register delete_contact tool', () => {
      registerContactTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'delete_contact',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Deal Tools', () => {
    it('should register list_deals tool', () => {
      registerDealTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'list_deals',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_deal tool', () => {
      registerDealTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_deal',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register create_deal tool', () => {
      registerDealTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'create_deal',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register update_deal tool', () => {
      registerDealTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'update_deal',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register update_deal_stage tool', () => {
      registerDealTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'update_deal_stage',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register delete_deal tool', () => {
      registerDealTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'delete_deal',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_pipeline_summary tool', () => {
      registerDealTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_pipeline_summary',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('get_pipeline_summary handler should call DealService with tenantId', async () => {
      const mockPipelineData = [
        { stage: 'LEAD', _count: { id: 5 }, _sum: { amount: 250000 } },
      ];
      mockPrisma.deal.groupBy.mockResolvedValue(mockPipelineData);

      registerDealTools(mockServer as any, auth, wrapToolHandler);

      const pipelineHandler = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'get_pipeline_summary'
      )[3];

      const result = await pipelineHandler({});

      expect(mockPrisma.deal.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: auth.tenantId,
          }),
        })
      );
      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('Activity Tools', () => {
    it('should register list_activities tool', () => {
      registerActivityTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'list_activities',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_activity tool', () => {
      registerActivityTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_activity',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register create_activity tool', () => {
      registerActivityTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'create_activity',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register update_activity tool', () => {
      registerActivityTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'update_activity',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register toggle_activity_complete tool', () => {
      registerActivityTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'toggle_activity_complete',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register delete_activity tool', () => {
      registerActivityTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'delete_activity',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Note Tools', () => {
    it('should register get_note tool', () => {
      registerNoteTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_note',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register update_note tool', () => {
      registerNoteTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'update_note',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register delete_note tool', () => {
      registerNoteTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'delete_note',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Report Tools', () => {
    it('should register get_pipeline_report tool', () => {
      registerReportTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_pipeline_report',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_win_rate_report tool', () => {
      registerReportTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_win_rate_report',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_cycle_time_report tool', () => {
      registerReportTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_cycle_time_report',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_activity_volume_report tool', () => {
      registerReportTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_activity_volume_report',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_top_accounts_report tool', () => {
      registerReportTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_top_accounts_report',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should register get_forecast_report tool', () => {
      registerReportTools(mockServer as any, auth, wrapToolHandler);

      expect(mockServer.tool).toHaveBeenCalledWith(
        'get_forecast_report',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Tool Handler Integration', () => {
    it('should pass auth context to all tool handlers', async () => {
      const mockOrgs = [{ id: 'org-1', name: 'SVT', tenantId: auth.tenantId }];
      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);
      mockPrisma.organization.count.mockResolvedValue(1);

      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      const listHandler = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'list_organizations'
      )[3];

      await listHandler({});

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: auth.tenantId,
          }),
        })
      );
    });

    it('should use auth.userId for create operations', async () => {
      const mockOrg = {
        id: 'org-new',
        name: 'YLE',
        tenantId: auth.tenantId,
        createdByUserId: auth.userId,
      };
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      registerOrganizationTools(mockServer as any, auth, wrapToolHandler);

      const createHandler = mockServer.tool.mock.calls.find(
        (call) => call[0] === 'create_organization'
      )[3];

      await createHandler({ name: 'YLE' });

      expect(mockPrisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: auth.tenantId,
            createdByUserId: auth.userId,
          }),
        })
      );
    });
  });
});
