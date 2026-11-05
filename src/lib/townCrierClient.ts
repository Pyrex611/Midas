/**
 * Town Crier Universal Client SDK
 * Works seamlessly in Next.js (App & Pages Router), Node.js (Backend), and Vite (React).
 */

export interface TownCrierSubscribeOptions {
  email: string;
  name?: string;
  tags?: string[];
  campaignId?: string;
  metadata?: Record<string, any>;
}

export interface TownCrierClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class TownCrierClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: TownCrierClientConfig) {
    if (!config.apiKey || !config.apiKey.startsWith('tc_live_')) {
      throw new Error('TownCrierClient: A valid API key starting with "tc_live_" is required.');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  }

  /**
   * Subscribes a single user.
   * If campaignId is provided, also stages the subscriber into that outreach campaign.
   */
  async subscribe(options: TownCrierSubscribeOptions) {
    if (!options.email || !options.email.includes('@')) {
      throw new Error('TownCrierClient: A valid email address is required.');
    }

    const endpoint = `${this.baseUrl}/api/public/town-crier/subscribe`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        email: options.email.trim().toLowerCase(),
        name: options.name?.trim() || undefined,
        tags: options.tags || ['sdk_signup'],
        campaignId: options.campaignId?.trim() || undefined,
        metadata: options.metadata || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Subscription failed (HTTP ${response.status})`);
    }

    return data;
  }

  /**
   * Bulk Ingestion: Enrolls multiple subscribers in a single atomic request.
   */
  async bulkSubscribe(subscribers: Array<{ email: string; name?: string; tags?: string[] }>) {
    const endpoint = `${this.baseUrl}/api/public/town-crier/subscribe`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ subscribers }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Bulk subscription failed (HTTP ${response.status})`);
    }

    return data;
  }

  /**
   * Exports audience dump for external data warehouse sync.
   */
  async export(status: string = 'SUBSCRIBED') {
    const endpoint = `${this.baseUrl}/api/public/town-crier/export?status=${encodeURIComponent(status)}`;
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Export failed (HTTP ${response.status})`);
    }

    return data;
  }
}