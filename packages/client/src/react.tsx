import React, { useCallback, useState, useEffect } from 'react';

export interface MidasModalProps {
  apiKey?: string;
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

/**
 * Native React Hook for triggering the Midas modal imperatively
 */
export function useMidasModal(defaultConfig?: {
  apiKey?: string;
  gongId?: string;
  headline?: string;
  accent?: string;
  fields?: string[];
  developerToggle?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Lazy-load widget.js on demand if not present in DOM
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).TownCrier) {
      const existing = document.querySelector('script[src*="widget.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://midas-aem.vercel.app/api/public/town-crier/widget.js';
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, []);

  const open = useCallback(
    (overrideConfig?: {
      apiKey?: string;
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

      if (typeof window !== 'undefined' && (window as any).TownCrier?.openModal) {
        (window as any).TownCrier.openModal({
          apiKey: cfg.apiKey,
          gongId: cfg.gongId,
          headline: cfg.headline,
          accent: cfg.accent,
          fields: rawFields,
        });
        setIsOpen(true);
      } else {
        // Fallback: poll briefly for widget script hydration
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if ((window as any).TownCrier?.openModal) {
            clearInterval(interval);
            (window as any).TownCrier.openModal({
              apiKey: cfg.apiKey,
              gongId: cfg.gongId,
              headline: cfg.headline,
              accent: cfg.accent,
              fields: rawFields,
            });
            setIsOpen(true);
          } else if (attempts > 10) {
            clearInterval(interval);
            console.error('Midas: widget.js failed to load. Check network connection.');
          }
        }, 150);
      }
    },
    [defaultConfig]
  );

  return { open, isOpen };
}

export const useTownCrierModal = useMidasModal;

/**
 * 1-Line Clerk-Parity React Component Wrapper
 * Usage:
 *   <MidasModal gongId="saas-weekly" developerToggle accent="#7C3AED">
 *     Join the Newsletter
 *   </MidasModal>
 */
export const MidasModal: React.FC<MidasModalProps> = ({
  apiKey,
  gongId,
  fields,
  developerToggle = false,
  cadenceToggle = true,
  accent = '#2563EB',
  bg = '#FFFFFF',
  text = '#18181B',
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
    gongId,
    headline,
    accent,
    fields: activeFields,
  });

  return (
    <button
      type="button"
      onClick={() => open()}
      data-town-crier-modal
      data-key={apiKey}
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
  gongId,
  layout = 'card',
  accent = '#2563EB',
  bg = '#FFFFFF',
  radius = '16px',
  headline = 'Join our newsletter',
  subheadline = 'Get updates in your inbox.',
  buttonText = 'Subscribe',
  className = '',
}) => {
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).TownCrier) {
      const script = document.createElement('script');
      script.src = 'https://midas-aem.vercel.app/api/public/town-crier/widget.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div
      data-town-crier-embed
      data-key={apiKey}
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