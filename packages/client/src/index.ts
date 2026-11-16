import crypto from 'crypto';

export interface MidasConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface SubscribePayload {
  email: string;
  name?: string;
  gongId?: string;
  cadence?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  tags?: string[];
  campaignId?: string;
  metadata?: Record<string, any>;
}

export interface BroadcastPayload {
  subject: string;
  body: string;
  templateStyle?: 'card' | 'editorial' | 'minimal' | 'plain';
  tagFilter?: string;
}

export interface GongPayload {
  name: string;
  slug?: string;
  description?: string;
  cadence?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  templateStyle?: 'card' | 'editorial' | 'minimal' | 'plain';
  welcomeEmailEnabled?: boolean;
  welcomeSubject?: string;
  welcomeBody?: string;
  embedTheme?: 'minimal' | 'card' | 'dark' | 'floating';
  accentColor?: string;
  headline?: string;
  buttonText?: string;
}

export interface ArtifactLinkPayload {
  title: string;
  url: string;
  slug?: string;
  description?: string;
  usagePrompt?: string;
  type?: 'LINK' | 'DOCUMENT' | 'IMAGE';
  attachmentMode?: 'LINK' | 'MIME_ATTACHMENT';
  isOneTime?: boolean;
  campaignId?: string;
  gongId?: string;
  broadcastId?: string;
}

export class MidasAPIError extends Error {
  constructor(public status: number, message: string, public payload?: any) {
    super(message);
    this.name = 'MidasAPIError';
  }
}

export class MidasClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: MidasConfig) {
    const resolvedKey =
      config?.apiKey ||
      (typeof process !== 'undefined' ? process.env?.MIDAS_API_KEY || process.env?.TOWN_CRIER_API_KEY : undefined);

    if (!resolvedKey) {
      throw new Error(
        'MidasClient requires an API Key. Pass { apiKey: "midas_live_..." } or set MIDAS_API_KEY in environment.'
      );
    }

    this.apiKey = resolvedKey;
    const rawUrl =
      config?.baseUrl ||
      (typeof process !== 'undefined' ? process.env?.MIDAS_BASE_URL : undefined) ||
      'https://midas-aem.vercel.app';

    this.baseUrl = rawUrl.replace(/\/$/, '');
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

    if (!res.ok) {
      throw new MidasAPIError(res.status, data.error || data.message || `HTTP Error ${res.status}`, data);
    }

    return data as T;
  }

  async subscribe(payload: SubscribePayload) {
    return this.request('/api/public/town-crier/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkSubscribe(subscribers: SubscribePayload[]) {
    return this.request('/api/public/town-crier/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscribers }),
    });
  }

  async getStats() {
    return this.request('/api/public/town-crier/stats', { method: 'GET' });
  }

  async listGongs() {
    return this.request('/api/public/town-crier/gongs', { method: 'GET' });
  }

  async createGong(payload: GongPayload) {
    return this.request('/api/public/town-crier/gongs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async broadcast(gongIdOrSlug: string, payload: BroadcastPayload) {
    return this.request(`/api/public/town-crier/gongs/${encodeURIComponent(gongIdOrSlug)}/broadcast`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getCampaigns() {
    return this.request('/api/campaigns', { method: 'GET' });
  }

  async dispatchCampaign(campaignId: string) {
    return this.request(`/api/campaigns/${encodeURIComponent(campaignId)}/dispatch-now`, { method: 'POST' });
  }

  async addLeadsToCampaign(campaignId: string, leadIds: string[]) {
    return this.request(`/api/campaigns/${encodeURIComponent(campaignId)}/leads`, {
      method: 'POST',
      body: JSON.stringify({ leadIds }),
    });
  }

  async enrichLead(leadId: string) {
    return this.request(`/api/leads/${encodeURIComponent(leadId)}/enrich`, { method: 'POST' });
  }

  async listArtifacts(filters?: { campaignId?: string; gongId?: string; broadcastId?: string }) {
    const qs = new URLSearchParams();
    if (filters?.campaignId) qs.set('campaignId', filters.campaignId);
    if (filters?.gongId) qs.set('gongId', filters.gongId);
    if (filters?.broadcastId) qs.set('broadcastId', filters.broadcastId);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/api/artifacts${query}`, { method: 'GET' });
  }

  async createArtifactLink(payload: ArtifactLinkPayload) {
    return this.request('/api/artifacts/link', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteArtifact(artifactId: string) {
    return this.request(`/api/artifacts/${encodeURIComponent(artifactId)}`, { method: 'DELETE' });
  }

  async getSandboxStatus() {
    return this.request('/api/sandbox/status', { method: 'GET' });
  }

  async sendSandboxTest(payload?: { subject?: string; body?: string }) {
    return this.request('/api/sandbox/test-send', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  static verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string, secret: string): boolean {
    if (!signatureHeader || !secret) return false;

    try {
      const parts = signatureHeader.split(',');
      let timestamp = '';
      let signature = '';

      for (const part of parts) {
        const [k, v] = part.split('=');
        if (k === 't') timestamp = v;
        if (k === 'v1') signature = v;
      }

      if (!timestamp || !signature) return false;

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        return false;
      }

      const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${bodyString}`)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch {
      return false;
    }
  }
}

export const TownCrierClient = MidasClient;
export default MidasClient;