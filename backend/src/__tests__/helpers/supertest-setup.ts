import supertest from 'supertest';
import app from '../../app';
import { generateAccessToken, JWTPayload } from '../../utils/auth';

export const request = supertest(app);

/**
 * Create a SuperTest agent with a valid JWT token for authenticated requests
 */
export const createAuthenticatedAgent = (userPayload?: Partial<JWTPayload>) => {
  const payload: JWTPayload = {
    userId: userPayload?.userId || 'user-1',
    tenantId: userPayload?.tenantId || 'tenant-1',
    email: userPayload?.email || 'admin@demo.com',
    role: userPayload?.role || 'ADMIN',
  };

  const token = generateAccessToken(payload);

  return {
    get: (url: string) => request.get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request.post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request.patch(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request.put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request.delete(url).set('Authorization', `Bearer ${token}`),
    token,
    payload,
  };
};

// Helper constants for test tenant IDs
export const TEST_TENANT_A = 'tenant-a';
export const TEST_TENANT_B = 'tenant-b';

// Helper constants for test user IDs
export const TEST_USER_ADMIN = 'user-admin-1';
export const TEST_USER_REGULAR = 'user-regular-1';
