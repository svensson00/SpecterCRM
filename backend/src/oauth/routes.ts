import { Router, Request, Response } from 'express';
import cors from 'cors';
import { OAuthService } from './service';
import { renderLoginPage, renderConsentPage, renderErrorPage } from './views';
import {
  clientRegistrationSchema,
  authorizeQuerySchema,
  loginFormSchema,
  consentFormSchema,
  tokenRequestSchema,
} from './validation';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Create OAuth router
 */
export function createOAuthRouter(): Router {
  const router = Router();

  // Enable CORS for /register and /token endpoints (Claude makes cross-origin requests)
  const corsOptions = { origin: true };

  /**
   * POST /oauth/register - Dynamic Client Registration
   */
  router.post('/register', cors(corsOptions), async (req: Request, res: Response) => {
    try {
      const data = clientRegistrationSchema.parse(req.body);

      const client = await OAuthService.registerClient(data);

      res.status(201).json({
        client_id: client.clientId,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        token_endpoint_auth_method: 'none',
      });
    } catch (error) {
      logger.error('Client registration error:', error);

      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error && 'issues' in error) {
        // Zod validation error
        res.status(400).json({ error: 'Validation error', details: error });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  /**
   * GET /oauth/authorize - Login Page
   */
  router.get('/authorize', async (req: Request, res: Response) => {
    try {
      const params = authorizeQuerySchema.parse(req.query);

      const client = await OAuthService.validateClient(params.client_id, params.redirect_uri);

      const html = renderLoginPage({
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method,
        state: params.state,
        scope: params.scope,
        clientName: client.clientName,
      });

      res.removeHeader('Content-Security-Policy');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      logger.error('Authorization page error:', error);

      const errorHtml = renderErrorPage(
        'Authorization Error',
        error instanceof AppError ? error.message : 'Invalid authorization request'
      );

      res.removeHeader('Content-Security-Policy');
      res.setHeader('Content-Type', 'text/html');
      res.status(400).send(errorHtml);
    }
  });

  /**
   * POST /oauth/authorize - Login Form Submit
   */
  router.post('/authorize', async (req: Request, res: Response) => {
    try {
      const data = loginFormSchema.parse(req.body);

      // Authenticate user
      const user = await OAuthService.authenticateUser(data.email, data.password);

      // Validate client
      const client = await OAuthService.validateClient(data.client_id, data.redirect_uri);

      // Generate auth session token
      const authSessionToken = OAuthService.generateAuthSessionToken({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      });

      // Render consent page
      const userName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

      const html = renderConsentPage({
        clientName: client.clientName,
        scope: data.scope,
        authSessionToken,
        clientId: data.client_id,
        redirectUri: data.redirect_uri,
        codeChallenge: data.code_challenge,
        codeChallengeMethod: data.code_challenge_method,
        state: data.state,
        userName,
      });

      res.removeHeader('Content-Security-Policy');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      logger.error('Login error:', error);

      // Re-render login page with error
      try {
        const data = loginFormSchema.parse(req.body);
        const client = await OAuthService.validateClient(data.client_id, data.redirect_uri);

        const errorMessage = error instanceof AppError
          ? error.message
          : 'An error occurred during login. Please try again.';

        const html = renderLoginPage({
          clientId: data.client_id,
          redirectUri: data.redirect_uri,
          codeChallenge: data.code_challenge,
          codeChallengeMethod: data.code_challenge_method,
          state: data.state,
          scope: data.scope,
          clientName: client.clientName,
          error: errorMessage,
        });

        res.removeHeader('Content-Security-Policy');
        res.setHeader('Content-Type', 'text/html');
        res.status(401).send(html);
      } catch (renderError) {
        logger.error('Error rendering login page:', renderError);
        const errorHtml = renderErrorPage('Error', 'An unexpected error occurred');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('Content-Type', 'text/html');
        res.status(500).send(errorHtml);
      }
    }
  });

  /**
   * POST /oauth/authorize/consent - Consent Decision
   */
  router.post('/authorize/consent', async (req: Request, res: Response) => {
    try {
      const data = consentFormSchema.parse(req.body);

      // Verify auth session token
      const authPayload = OAuthService.verifyAuthSessionToken(data.auth_session_token);

      // Validate client
      await OAuthService.validateClient(data.client_id, data.redirect_uri);

      if (data.decision === 'deny') {
        // User denied consent - redirect with error
        const url = new URL(data.redirect_uri);
        url.searchParams.set('error', 'access_denied');
        if (data.state) {
          url.searchParams.set('state', data.state);
        }
        res.redirect(url.toString());
        return;
      }

      // User allowed - create authorization code
      const code = await OAuthService.createAuthorizationCode({
        clientId: data.client_id,
        userId: authPayload.userId,
        tenantId: authPayload.tenantId,
        redirectUri: data.redirect_uri,
        codeChallenge: data.code_challenge,
        codeChallengeMethod: data.code_challenge_method,
        scope: data.scope,
        state: data.state,
      });

      // Redirect with authorization code
      const url = new URL(data.redirect_uri);
      url.searchParams.set('code', code);
      if (data.state) {
        url.searchParams.set('state', data.state);
      }

      res.redirect(url.toString());
    } catch (error) {
      logger.error('Consent error:', error);

      const errorHtml = renderErrorPage(
        'Consent Error',
        error instanceof AppError ? error.message : 'An error occurred processing your consent'
      );

      res.removeHeader('Content-Security-Policy');
      res.setHeader('Content-Type', 'text/html');
      res.status(400).send(errorHtml);
    }
  });

  /**
   * POST /oauth/token - Token Exchange
   */
  router.post('/token', cors(corsOptions), async (req: Request, res: Response) => {
    try {
      const data = tokenRequestSchema.parse(req.body);

      if (data.grant_type === 'authorization_code') {
        if (!data.code || !data.code_verifier || !data.redirect_uri) {
          res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameters' });
          return;
        }

        const result = await OAuthService.exchangeCode(
          data.code,
          data.code_verifier,
          data.client_id,
          data.redirect_uri
        );

        res.json(result);
      } else if (data.grant_type === 'refresh_token') {
        if (!data.refresh_token) {
          res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token' });
          return;
        }

        const result = await OAuthService.refreshAccessToken(data.refresh_token, data.client_id);

        res.json(result);
      } else {
        res.status(400).json({ error: 'unsupported_grant_type' });
      }
    } catch (error) {
      logger.error('Token error:', error);

      if (error instanceof AppError) {
        res.status(400).json({ error: 'invalid_grant', error_description: error.message });
      } else if (error instanceof Error && 'issues' in error) {
        res.status(400).json({ error: 'invalid_request', error_description: 'Validation error' });
      } else {
        res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
      }
    }
  });

  return router;
}
