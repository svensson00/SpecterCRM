/**
 * REST API client for E2E test setup/teardown operations
 */

const BASE_URL = 'http://localhost:3000/api';

export class ApiClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Factory method: login and return authenticated client.
   * Retries on 409 Conflict (duplicate refresh token from rapid successive logins).
   */
  static async login(email: string, password: string, retries = 3): Promise<ApiClient> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        return new ApiClient(data.accessToken);
      }

      // Retry on 409 Conflict (duplicate refresh token hash from rapid logins)
      if (response.status === 409 && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }

      throw new Error(`Login failed: ${response.statusText}`);
    }

    throw new Error('Login failed after retries');
  }

  private async request(method: string, path: string, body?: any) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    // Handle empty responses (e.g., 204 No Content from DELETE)
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  // Organizations
  async createOrganization(data: any) {
    return this.request('POST', '/organizations', data);
  }

  async deleteOrganization(id: string) {
    return this.request('DELETE', `/organizations/${id}`);
  }

  async getOrganizations(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request('GET', `/organizations${query}`);
  }

  // Contacts
  async createContact(data: any) {
    return this.request('POST', '/contacts', data);
  }

  async deleteContact(id: string) {
    return this.request('DELETE', `/contacts/${id}`);
  }

  async getContacts(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request('GET', `/contacts${query}`);
  }

  // Deals
  async createDeal(data: any) {
    return this.request('POST', '/deals', data);
  }

  async deleteDeal(id: string) {
    return this.request('DELETE', `/deals/${id}`);
  }

  async getDeals(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request('GET', `/deals${query}`);
  }

  // Activities
  async createActivity(data: any) {
    return this.request('POST', '/activities', data);
  }

  async deleteActivity(id: string) {
    return this.request('DELETE', `/activities/${id}`);
  }

  async getActivities(params?: any) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return this.request('GET', `/activities${query}`);
  }

  // Admin
  async createActivityType(data: any) {
    return this.request('POST', '/admin/activity-types', data);
  }

  async deleteActivityType(id: string) {
    return this.request('DELETE', `/admin/activity-types/${id}`);
  }

  async getActivityTypes() {
    return this.request('GET', '/admin/activity-types');
  }
}
