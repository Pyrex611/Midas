import { useCallback, useState } from 'react';

export interface TownCrierFieldSchema {
  name: string;
  type: 'email' | 'text' | 'url' | 'number' | 'tel' | 'select' | 'boolean' | 'cadence';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  followUp?: Omit<TownCrierFieldSchema, 'followUp'>;
}

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

    if (!key && typeof process !== 'undefined' && process.env) {
      key = (
        process.env.MIDAS_API_KEY ||
        process.env.TOWN_CRIER_API_KEY ||
        process.env.NEXT_PUBLIC_MIDAS_API_KEY
      )?.trim();
    }

    if (!key && typeof import.meta !== 'undefined' && (import.meta as any).env) {
      key = ((import.meta as any).env.VITE_MIDAS_API_KEY)?.trim();
    }

    if (!key || (!key.startsWith('midas_live_') && !key.startsWith('tc_live_'))) {
      throw new Error(
        'MidasClient: A valid API key starting with "midas_live_" or "tc_live_" is required. ' +
        'Pass apiKey to the constructor or set MIDAS_API_KEY in your environment variables.'
      );
    }

    this.apiKey = key;
    this.baseUrl = (
      config?.baseUrl ||
      (typeof process !== 'undefined' && process.env?.MIDAS_BASE_URL) ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://midas-aem.vercel.app')
    ).replace(/\/$/, '');
  }

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

  async listGongs() {
    const endpoint = `${this.baseUrl}/api/public/town-crier/gongs`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to list Gongs');
    return data.gongs || [];
  }

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

  async getStats() {
    const endpoint = `${this.baseUrl}/api/public/town-crier/stats`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to fetch telemetry');
    return data;
  }
}

export const TownCrierClient = MidasClient;

/**
 * React Hook for Zero-Boilerplate Modal Subscriptions with Progressive Profiling
 */
export function useMidasModal(defaultConfig?: {
  apiKey?: string;
  gongId?: string;
  headline?: string;
  accent?: string;
  fields?: string[];
  schema?: TownCrierFieldSchema[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(
    (overrideConfig?: {
      apiKey?: string;
      gongId?: string;
      headline?: string;
      accent?: string;
      fields?: string[];
      schema?: TownCrierFieldSchema[];
    }) => {
      const cfg = { ...defaultConfig, ...overrideConfig };
      if (typeof window !== 'undefined' && (window as any).TownCrier?.openModal) {
        (window as any).TownCrier.openModal({
          apiKey: cfg.apiKey,
          gongId: cfg.gongId,
          headline: cfg.headline,
          accent: cfg.accent,
          fields: cfg.fields,
          schema: cfg.schema,
        });
        setIsOpen(true);
      } else {
        console.warn('TownCrier widget.js script is not loaded in the window.');
      }
    },
    [defaultConfig]
  );

  return { open, isOpen };
}

export const useTownCrierModal = useMidasModal;