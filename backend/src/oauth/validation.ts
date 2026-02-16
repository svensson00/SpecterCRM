import { z } from 'zod';

// POST /oauth/register - Dynamic Client Registration
export const clientRegistrationSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  redirect_uris: z.array(z.string().url('Invalid redirect URI')).min(1, 'At least one redirect URI is required'),
  grant_types: z.array(z.string()).optional().default(['authorization_code']),
  token_endpoint_auth_method: z.string().optional().default('none'),
});

// GET /oauth/authorize - Authorization Request
export const authorizeQuerySchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1, 'Client ID is required'),
  redirect_uri: z.string().url('Invalid redirect URI'),
  code_challenge: z.string().min(1, 'Code challenge is required'),
  code_challenge_method: z.literal('S256'),
  state: z.string().optional(),
  scope: z.string().optional(),
});

// POST /oauth/authorize - Login Form Submit
export const loginFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal('S256'),
  state: z.string().optional(),
  scope: z.string().optional(),
});

// POST /oauth/authorize/consent - Consent Decision
export const consentFormSchema = z.object({
  auth_session_token: z.string().min(1, 'Auth session token is required'),
  decision: z.enum(['allow', 'deny']),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal('S256'),
  state: z.string().optional(),
  scope: z.string().optional(),
});

// POST /oauth/token - Token Request
export const tokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  redirect_uri: z.string().optional(),
  code_verifier: z.string().optional(),
  client_id: z.string().min(1, 'Client ID is required'),
  refresh_token: z.string().optional(),
});
