interface LoginPageParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  scope?: string;
  clientName: string;
  error?: string;
}

interface ConsentPageParams {
  clientName: string;
  scope?: string;
  authSessionToken: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  userName: string;
}

/**
 * Render login page with dark theme
 */
export function renderLoginPage(params: LoginPageParams): string {
  const errorHtml = params.error
    ? `<div style="background-color: #7f1d1d; border: 1px solid #dc2626; color: #fca5a5; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">${escapeHtml(params.error)}</div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to SpecterCRM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0f172a; color: #ffffff; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
  <div style="width: 100%; max-width: 420px; padding: 24px;">
    <div style="background-color: #1e293b; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); padding: 40px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 700; color: #3b82f6;">SpecterCRM</h1>
        <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #ffffff;">Sign in to continue</h2>
        <p style="margin: 0; font-size: 14px; color: #94a3b8;">Authorize ${escapeHtml(params.clientName)} to access your CRM data</p>
      </div>

      ${errorHtml}

      <form method="POST" action="/oauth/authorize">
        <div style="margin-bottom: 20px;">
          <label for="email" style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #e2e8f0;">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            style="width: 100%; padding: 12px; font-size: 14px; background-color: #334155; color: #ffffff; border: 1px solid #475569; border-radius: 8px; outline: none; box-sizing: border-box;"
          />
        </div>

        <div style="margin-bottom: 24px;">
          <label for="password" style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #e2e8f0;">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            style="width: 100%; padding: 12px; font-size: 14px; background-color: #334155; color: #ffffff; border: 1px solid #475569; border-radius: 8px; outline: none; box-sizing: border-box;"
          />
        </div>

        <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
        <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
        <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
        <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
        ${params.state ? `<input type="hidden" name="state" value="${escapeHtml(params.state)}" />` : ''}
        ${params.scope ? `<input type="hidden" name="scope" value="${escapeHtml(params.scope)}" />` : ''}

        <button
          type="submit"
          style="width: 100%; padding: 12px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #3b82f6; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s;"
          onmouseover="this.style.backgroundColor='#2563eb'"
          onmouseout="this.style.backgroundColor='#3b82f6'"
        >
          Sign in
        </button>
      </form>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Render consent page with dark theme
 */
export function renderConsentPage(params: ConsentPageParams): string {
  const scopes = params.scope?.split(' ') || ['crm:read', 'crm:write'];
  const scopeDescriptions: Record<string, string> = {
    'crm:read': 'Read your CRM data',
    'crm:write': 'Create and modify CRM data',
  };

  const scopeListHtml = scopes
    .map(scope => {
      const description = scopeDescriptions[scope] || scope;
      return `<li style="margin-bottom: 8px; color: #cbd5e1; font-size: 14px;">✓ ${escapeHtml(description)}</li>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Access - SpecterCRM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0f172a; color: #ffffff; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
  <div style="width: 100%; max-width: 480px; padding: 24px;">
    <div style="background-color: #1e293b; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); padding: 40px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #ffffff;">Authorize Access</h1>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #94a3b8;">${escapeHtml(params.clientName)} wants to access your SpecterCRM data</p>
        <div style="background-color: #334155; padding: 12px; border-radius: 8px; margin-top: 16px;">
          <p style="margin: 0; font-size: 14px; color: #cbd5e1;">Signed in as <strong>${escapeHtml(params.userName)}</strong></p>
        </div>
      </div>

      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #e2e8f0;">This application will be able to:</h3>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${scopeListHtml}
        </ul>
      </div>

      <form method="POST" action="/oauth/authorize/consent" style="display: flex; gap: 12px;">
        <input type="hidden" name="auth_session_token" value="${escapeHtml(params.authSessionToken)}" />
        <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
        <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
        <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
        <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
        ${params.state ? `<input type="hidden" name="state" value="${escapeHtml(params.state)}" />` : ''}
        ${params.scope ? `<input type="hidden" name="scope" value="${escapeHtml(params.scope)}" />` : ''}

        <button
          type="submit"
          name="decision"
          value="deny"
          style="flex: 1; padding: 12px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #475569; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s;"
          onmouseover="this.style.backgroundColor='#64748b'"
          onmouseout="this.style.backgroundColor='#475569'"
        >
          Deny
        </button>

        <button
          type="submit"
          name="decision"
          value="allow"
          style="flex: 1; padding: 12px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #3b82f6; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s;"
          onmouseover="this.style.backgroundColor='#2563eb'"
          onmouseout="this.style.backgroundColor='#3b82f6'"
        >
          Allow
        </button>
      </form>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Render error page with dark theme
 */
export function renderErrorPage(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - SpecterCRM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0f172a; color: #ffffff; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
  <div style="width: 100%; max-width: 480px; padding: 24px;">
    <div style="background-color: #1e293b; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); padding: 40px; text-align: center;">
      <div style="font-size: 64px; margin-bottom: 16px;">⚠️</div>
      <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #ffffff;">${escapeHtml(title)}</h1>
      <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">${escapeHtml(message)}</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
