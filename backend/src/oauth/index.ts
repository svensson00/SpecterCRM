import { Express, Request } from 'express';
import { createOAuthRouter } from './routes';

function getBaseUrl(req: Request): string {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

export function mountOAuth(app: Express): void {
  // RFC 9728: Protected Resource Metadata
  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: ['crm:read', 'crm:write'],
    });
  });

  // RFC 8414: OAuth Authorization Server Metadata
  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      scopes_supported: ['crm:read', 'crm:write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  // Mount OAuth routes
  app.use('/oauth', createOAuthRouter());
}
