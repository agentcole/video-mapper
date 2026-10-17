import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

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
    <div className="flex items-center gap-3 bg-black/85 text-white text-sm rounded-lg px-4 py-2 shadow-xl backdrop-blur-sm">
      <span>A new version is available.</span>
      <button onClick={() => updateServiceWorker(true)} className="underline whitespace-nowrap">
        Reload
      </button>
      <button onClick={() => setNeedRefresh(false)} className="text-white/70 hover:text-white">
        Later
      </button>
    </div>
  );
};
