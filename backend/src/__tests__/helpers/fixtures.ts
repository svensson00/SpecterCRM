import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { JWTPayload } from '../../utils/auth';

// Factory functions for mock data using Eyevinn-realistic test data

export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@demo.com',
  passwordHash: '$2b$12$mockedHashForTesting',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

export const createMockOrganization = (overrides: Partial<any> = {}) => ({
  id: 'org-1',
  tenantId: 'tenant-1',
  name: 'SVT',
  website: 'https://www.svt.se',
  street: 'Oxenstiernsgatan 26-34',
  city: 'Stockholm',
  zip: '115 22',
  country: 'Sweden',
  ownerUserId: 'user-1',
  createdByUserId: 'user-1',
  updatedByUserId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

export const createMockContact = (overrides: Partial<any> = {}) => ({
  id: 'contact-1',
  tenantId: 'tenant-1',
  firstName: 'Erik',
  lastName: 'Andersson',
  jobTitle: 'CTO',
  contactRole: 'CTO',
  primaryOrganizationId: 'org-1',
  ownerUserId: 'user-1',
  createdByUserId: 'user-1',
  updatedByUserId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

export const createMockDeal = (overrides: Partial<any> = {}) => ({
  id: 'deal-1',
  tenantId: 'tenant-1',
  title: 'Streaming Architecture Review',
  organizationId: 'org-1',
  amount: 50000,
  currency: 'USD',
  expectedCloseDate: new Date('2024-06-30T00:00:00.000Z'),
  stage: 'PROSPECT',
  probability: 60,
  reasonLost: null,
  ownerUserId: 'user-1',
  createdByUserId: 'user-1',
  updatedByUserId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

export const createMockActivity = (overrides: Partial<any> = {}) => ({
  id: 'activity-1',
  tenantId: 'tenant-1',
  type: 'Workshop',
  subject: 'POC Demo Session',
  description: 'Demonstrate new streaming architecture POC',
  dueAt: new Date('2024-02-15T10:00:00.000Z'),
  isCompleted: false,
  completedAt: null,
  ownerUserId: 'user-1',
  relatedOrganizationId: 'org-1',
  relatedDealId: 'deal-1',
  createdByUserId: 'user-1',
  updatedByUserId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

export const createMockNote = (overrides: Partial<any> = {}) => ({
  id: 'note-1',
  tenantId: 'tenant-1',
  content: 'Discussed technical requirements for the streaming platform migration.',
  entityType: 'ORGANIZATION',
  entityId: 'org-1',
  createdByUserId: 'user-1',
  updatedByUserId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

export const createMockJWTPayload = (overrides: Partial<JWTPayload> = {}): JWTPayload => ({
  userId: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@demo.com',
  role: 'ADMIN',
  ...overrides,
});

export const createMockAuthRequest = (overrides: Partial<AuthRequest> = {}): AuthRequest => {
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: createMockJWTPayload(),
    ...overrides,
  } as AuthRequest;
  return req;
};

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.sendStatus = vi.fn().mockReturnValue(res);
  return res;
};

// Eyevinn-specific test data sets
export const EYEVINN_ORGS = ['SVT', 'YLE', 'NRK', 'TV2 Norge', 'TV4 Sweden', 'OTTera'];
export const EYEVINN_CONTACT_ROLES = [
  'CTO',
  'Head of Streaming',
  'Lead Engineer',
  'VP Technology',
  'Product Manager',
];
export const EYEVINN_ACTIVITY_TYPES = [
  'Workshop',
  'POC Demo',
  'Architecture Review',
  'Conference Follow-up',
  'Client Call',
  'Technical Audit',
];
