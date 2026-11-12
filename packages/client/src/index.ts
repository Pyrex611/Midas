export interface MidasSubscribeOptions {
  email: string;
  name?: string;
  cadence?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | string;
  tags?: string[];
  gongId?: string;
  campaignId?: string;
  metadata?: Record<string, any>;
}

export interface MidasClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class MidasClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: MidasClientConfig) {
    let key = config?.apiKey?.trim();

    // 1. Resolve from Node.js / Next.js Server Environment variables
    if (!key && typeof process !== 'undefined' && process.env) {
      key = (
        process.env.MIDAS_API_KEY ||
        process.env.TOWN_CRIER_API_KEY ||
        process.env.NEXT_PUBLIC_MIDAS_API_KEY ||
        process.env.VITE_MIDAS_API_KEY
      )?.trim();
    }

    // 2. Resolve from Vite / Client bundler environment without triggering CJS warning
    if (!key && typeof window !== 'undefined') {
      try {
        const getMetaEnv = new Function('try { return import.meta.env; } catch (e) { return null; }');
        const env = getMetaEnv();
        if (env && env.VITE_MIDAS_API_KEY) {
          key = String(env.VITE_MIDAS_API_KEY).trim();
        }
      } catch {}
    }

    if (!key || (!key.startsWith('midas_live_') && !key.startsWith('tc_live_'))) {
      throw new Error(
        'MidasClient: A valid API key starting with "midas_live_" or "tc_live_" is required. ' +
        'Pass apiKey to the constructor or define MIDAS_API_KEY in your environment variables.'
      );
    }

    this.apiKey = key;
    this.baseUrl = (
      config?.baseUrl ||
      (typeof process !== 'undefined' && process.env?.MIDAS_BASE_URL) ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://midas-aem.vercel.app')
    ).replace(/\/$/, '');
  }

  // ========================================================================
  // TOWN CRIER (INBOUND / AUDIENCE ENGINE)
  // ========================================================================

  /**
   * Ingest a subscriber.
   * If gongId is specified and the channel has welcome autoresponders enabled,
   * Midas dispatches the welcome lead-magnet email automatically in <60 seconds.
   */
  async subscribe(options: MidasSubscribeOptions) {
    if (!options.email || !options.email.includes('@')) {
      throw new Error('MidasClient: A valid email address is required.');
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
        cadence: options.cadence || 'weekly',
        tags: options.tags || ['sdk_signup'],
        gongId: options.gongId?.trim() || undefined,
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
   * Programmatically query all active Gong publication channels
   */
  async listGongs() {
    const endpoint = `${this.baseUrl}/api/public/town-crier/gongs`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to list Gongs');
    return data.gongs || [];
  }

  /**
   * Headlessly publish a broadcast newsletter issue to a Gong channel
   */
  async publishBroadcast(gongId: string, issue: { subject: string; body: string; templateStyle?: string }) {
    const endpoint = `${this.baseUrl}/api/public/town-crier/gongs/${gongId}/broadcast`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(issue),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to publish broadcast');
    return data;
  }

  /**
   * Probe real-time audience and delivery telemetry
   */
  async getStats() {
    const endpoint = `${this.baseUrl}/api/public/town-crier/stats`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to fetch telemetry');
    return data;
  }

  // ========================================================================
  // CAMPAIGNS (OUTBOUND COLD SEQUENCE ENGINE)
  // ========================================================================

  /**
   * Fetch all active outreach campaigns and their performance metrics.
   * Requires API key scope: 'campaigns:read' or '*'
   */
  async getCampaigns() {
    const endpoint = `${this.baseUrl}/api/campaigns`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to fetch campaigns');
    return data;
  }

  /**
   * Programmatically trigger a bounded send sweep (≤5 emails) for a specific campaign.
   * Ideal for triggering dispatch pipelines from CI/CD or GitHub Actions.
   * Requires API key scope: 'campaigns:write' or '*'
   */
  async dispatchCampaign(campaignId: string) {
    const endpoint = `${this.baseUrl}/api/campaigns/${campaignId}/dispatch-now`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to dispatch campaign');
    return data;
  }

  /**
   * Stage pre-verified leads directly into an active campaign sequence.
   * Leads will be placed in PENDING state and queued for dispatch.
   * Requires API key scope: 'campaigns:write' or '*'
   */
  async addLeadsToCampaign(campaignId: string, leadIds: string[]) {
    const endpoint = `${this.baseUrl}/api/campaigns/${campaignId}/leads`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ leadIds }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to add leads to campaign');
    return data;
  }
}

// Backward-compatible alias
export const TownCrierClient = MidasClient;