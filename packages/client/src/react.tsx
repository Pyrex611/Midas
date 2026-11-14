import React, { useCallback, useState, useEffect } from 'react';

export interface MidasModalProps {
  apiKey?: string;
  baseUrl?: string;
  gongId?: string;
  fields?: Array<'email' | 'name' | 'company' | 'cadence' | 'developer' | string>;
  developerToggle?: boolean;
  cadenceToggle?: boolean;
  accent?: string;
  bg?: string;
  text?: string;
  radius?: string;
  headline?: string;
  subheadline?: string;
  buttonText?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface MidasEmbedProps {
  apiKey?: string;
  baseUrl?: string;
  gongId?: string;
  layout?: 'card' | 'horizontal';
  accent?: string;
  bg?: string;
  radius?: string;
  headline?: string;
  subheadline?: string;
  buttonText?: string;
  className?: string;
}

const DEFAULT_BASE_URL = 'https://midas-aem.vercel.app';

/**
 * Native React Hook for triggering the Midas modal imperatively
 */
export function useMidasModal(defaultConfig?: {
  apiKey?: string;
  baseUrl?: string;
  gongId?: string;
  headline?: string;
  accent?: string;
  fields?: string[];
  developerToggle?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const resolvedBaseUrl = (defaultConfig?.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).TownCrier) {
      const existing = document.querySelector('script[src*="widget.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = `${resolvedBaseUrl}/api/public/town-crier/widget.js`;
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [resolvedBaseUrl]);

  const open = useCallback(
    (overrideConfig?: {
      apiKey?: string;
      baseUrl?: string;
      gongId?: string;
      headline?: string;
      accent?: string;
      fields?: string[];
      developerToggle?: boolean;
    }) => {
      const cfg = { ...defaultConfig, ...overrideConfig };
      const rawFields = [...(cfg.fields || ['name', 'email', 'cadence'])];
      if (cfg.developerToggle && !rawFields.includes('developer')) {
        rawFields.push('developer');
      }

      const targetBase = (cfg.baseUrl || resolvedBaseUrl).replace(/\/$/, '');
      const endpoint = `${targetBase}/api/public/town-crier/subscribe`;

      if (typeof window !== 'undefined' && (window as any).TownCrier?.openModal) {
        (window as any).TownCrier.openModal({
          apiKey: cfg.apiKey,
          endpoint,
          gongId: cfg.gongId,
          headline: cfg.headline,
          accent: cfg.accent,
          fields: rawFields,
        });
        setIsOpen(true);
      } else {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if ((window as any).TownCrier?.openModal) {
            clearInterval(interval);
            (window as any).TownCrier.openModal({
              apiKey: cfg.apiKey,
              endpoint,
              gongId: cfg.gongId,
              headline: cfg.headline,
              accent: cfg.accent,
              fields: rawFields,
            });
            setIsOpen(true);
          } else if (attempts > 10) {
            clearInterval(interval);
            console.error('Midas: widget.js failed to load. Check network connection or baseUrl.');
          }
        }, 150);
      }
    },
    [defaultConfig, resolvedBaseUrl]
  );

  return { open, isOpen };
}

export const useTownCrierModal = useMidasModal;

/**
 * 1-Line Clerk-Parity React Component Wrapper
 */
export const MidasModal: React.FC<MidasModalProps> = ({
  apiKey,
  baseUrl,
  gongId,
  fields,
  developerToggle = false,
  cadenceToggle = true,
  accent = '#4A2559',
  bg = '#FFFFFF',
  text = '#1F1124',
  radius = '20px',
  headline = 'Join our Newsletter',
  subheadline = 'Get high-signal insights delivered to your inbox.',
  buttonText = 'Subscribe',
  className = '',
  style,
  children = 'Subscribe to Newsletter',
}) => {
  const activeFields = fields ? [...fields] : ['name', 'email'];
  if (cadenceToggle && !activeFields.includes('cadence')) activeFields.push('cadence');
  if (developerToggle && !activeFields.includes('developer')) activeFields.push('developer');

  const { open } = useMidasModal({
    apiKey,
    baseUrl,
    gongId,
    headline,
    accent,
    fields: activeFields,
  });

  const targetEndpoint = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/api/public/town-crier/subscribe`
    : undefined;

  return (
    <button
      type="button"
      onClick={() => open()}
      data-town-crier-modal
      data-key={apiKey}
      data-endpoint={targetEndpoint}
      data-gong={gongId}
      data-fields={activeFields.join(',')}
      data-headline={headline}
      data-subheadline={subheadline}
      data-accent={accent}
      data-bg={bg}
      data-text={text}
      data-radius={radius}
      data-button={buttonText}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
};

export const TownCrierModal = MidasModal;

/**
 * In-Page Responsive Inline Card Component
 */
export const MidasEmbed: React.FC<MidasEmbedProps> = ({
  apiKey,
  baseUrl,
  gongId,
  layout = 'card',
  accent = '#4A2559',
  bg = '#FFFFFF',
  radius = '16px',
  headline = 'Join our newsletter',
  subheadline = 'Get updates in your inbox.',
  buttonText = 'Subscribe',
  className = '',
}) => {
  const resolvedBaseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).TownCrier) {
      const existing = document.querySelector('script[src*="widget.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = `${resolvedBaseUrl}/api/public/town-crier/widget.js`;
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [resolvedBaseUrl]);

  const targetEndpoint = baseUrl ? `${resolvedBaseUrl}/api/public/town-crier/subscribe` : undefined;

  return (
    <div
      data-town-crier-embed
      data-key={apiKey}
      data-endpoint={targetEndpoint}
      data-gong={gongId}
      data-layout={layout}
      data-accent={accent}
      data-bg={bg}
      data-radius={radius}
      data-headline={headline}
      data-subheadline={subheadline}
      data-button={buttonText}
      className={className}
    />
  );
};