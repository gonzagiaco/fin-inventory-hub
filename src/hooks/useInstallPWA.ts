import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useInstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar si es iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Detectar si ya está instalado
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const installed = standalone || localStorage.getItem('pwa_installed') === 'true';
    setIsInstalled(installed);

    // Escuchar el evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detectar cuando se instala la app
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      localStorage.setItem('pwa_installed', 'true');
      setDeferredPrompt(null);
      setIsInstallable(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;

      if (result.outcome === 'accepted') {
        localStorage.setItem('pwa_installed', 'true');
        setIsInstalled(true);
      }

      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('Error al instalar PWA:', error);
    }
  };

  const shouldShowInstallPrompt = () => {
    return true; // Siempre mostrar el cartel
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    handleInstall,
    shouldShowInstallPrompt,
  };
};
