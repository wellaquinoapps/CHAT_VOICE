import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallAppBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar se já está instalado/rodando como app independente
    const inStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(inStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert('Para instalar:\nNo Chrome, toque no menu de 3 pontinhos e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".');
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || dismissed) return null;

  return (
    <div className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-4 py-3 shadow-md mx-3 my-2">
      <Download className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">Instalar PrivateLine</p>
        <p className="text-xs text-indigo-200 truncate">Adicione o app à tela inicial</p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-white text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors flex-shrink-0 shadow-sm"
      >
        Instalar
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-indigo-200 hover:text-white p-1 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

