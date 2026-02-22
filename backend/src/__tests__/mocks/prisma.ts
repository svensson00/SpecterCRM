import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Deep mock factory for all 19 Prisma models
// Each model needs: findMany, findFirst, findUnique, create, createMany, update, updateMany, delete, deleteMany, count, groupBy

const createModelMock = () => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  aggregate: vi.fn(),
  upsert: vi.fn(),
});

export const mockPrisma = {
  // Multi-tenancy & Authentication
  tenant: createModelMock(),
  user: createModelMock(),
  refreshToken: createModelMock(),

  // CRM Entities
  organization: createModelMock(),
  contact: createModelMock(),
  contactEmail: createModelMock(),
  contactPhone: createModelMock(),
  deal: createModelMock(),
  dealContact: createModelMock(),
  activity: createModelMock(),
  activityContact: createModelMock(),
  activityOrganization: createModelMock(),
  note: createModelMock(),

  // Configuration
  activityType: createModelMock(),
  contactRole: createModelMock(),

  // Data Quality
  duplicateSuggestion: createModelMock(),

  // Audit & History
  auditLog: createModelMock(),

  // User Preferences
  savedFilter: createModelMock(),

  // Import Jobs
  importJob: createModelMock(),

  // OAuth 2.1
  oAuthClient: createModelMock(),
  oAuthAuthorizationCode: createModelMock(),
  oAuthRefreshToken: createModelMock(),

  // Prisma special methods
  $transaction: vi.fn((fn) => fn(mockPrisma)),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $on: vi.fn(),
  $use: vi.fn(),
  $extends: vi.fn(),
} as unknown as PrismaClient;

export const resetAllMocks = () => {
  Object.values(mockPrisma).forEach((value) => {
    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach((method) => {
        if (typeof method === 'function' && 'mockReset' in method) {
          method.mockReset();
        }
      });
    } else if (typeof value === 'function' && 'mockReset' in value) {
      value.mockReset();
    }
  });
};
