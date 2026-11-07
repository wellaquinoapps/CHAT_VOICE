import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallAppBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const handleInstalled = () => {
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-4 py-3">
      <Download className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">Instalar PrivateLine</p>
        <p className="text-xs text-indigo-200">Use como aplicativo no seu dispositivo</p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-white text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        Instalar
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-indigo-200 hover:text-white p-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

