import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { noticeSurface } from './ui/theme';

// Registers the service worker (the only registration — see vite.config.ts)
// and offers a new version without interrupting: no blocking dialog, no
// automatic reload in the middle of a show. The user reloads when it suits.
export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className={`${noticeSurface} flex items-center gap-3`}>
      <span>A new version is available.</span>
      <button onClick={() => updateServiceWorker(true)} className="px-2 py-0.5 rounded bg-cyan-500 text-black font-semibold hover:bg-cyan-400 whitespace-nowrap">
        Reload
      </button>
      <button onClick={() => setNeedRefresh(false)} className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 whitespace-nowrap">
        Later
      </button>
    </div>
  );
};
