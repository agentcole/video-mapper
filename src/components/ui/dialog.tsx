import React from 'react';
import { X } from 'lucide-react';
import { dialogSurface, iconButton, panelTitle } from './theme';

// ---------------------------------------------------------------------------
// Modal dialog shell: dimmed backdrop, dark glass surface, a title bar with
// icon and close button — the frame for the media library and projects.
// ---------------------------------------------------------------------------

interface DialogProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  // Width class of the surface
  width?: string;
  // A click on the backdrop closes the dialog
  closeOnBackdrop?: boolean;
  // Extra controls in the title bar, before the close button
  actions?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  title, icon, onClose, children, width = 'max-w-4xl', closeOnBackdrop = false, actions,
}) => (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4"
    onClick={closeOnBackdrop ? onClose : undefined}
  >
    <div
      role="dialog"
      aria-modal="true"
      className={`${dialogSurface} w-full ${width} max-h-[80vh] flex flex-col overflow-hidden`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
        <h2 className={`${panelTitle} flex-1 min-w-0`}>
          {icon}
          {title}
        </h2>
        {actions}
        <button onClick={onClose} className={iconButton} title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
