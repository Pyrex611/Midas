import React, { useEffect } from 'react';
import { Icons } from '../../lib/icons';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl';
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'lg',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
  }[width];

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-royal-950/65 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex pl-10 max-w-full">
        <div
          className={`w-screen ${widthClasses} bg-white shadow-2xl border-l border-gold-500/45 flex flex-col transform transition-transform animate-in slide-in-from-right duration-300 ease-out`}
        >
          {/* Header with Golden Separator */}
          <div className="p-6 border-b border-gold-500/35 flex items-start justify-between bg-thistle-50/80">
            <div>
              <h2 className="text-lg font-bold text-royal-950 tracking-tight">{title}</h2>
              {description && <p className="text-xs text-thistle-500 mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-thistle-500 hover:text-royal-800 transition-colors p-1.5 rounded-lg hover:bg-thistle-100"
              aria-label="Close drawer"
            >
              <Icons.Close />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>

          {/* Footer with Golden Separator */}
          {footer && (
            <div className="p-4 border-t border-gold-500/35 bg-thistle-50/80 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};