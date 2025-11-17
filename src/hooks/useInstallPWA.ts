import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const useInstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Detectar si es iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Detectar si ya se está ejecutando como PWA (standalone mode)
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsPWA(standalone);

    // Método 1: Verificar si la app está instalada mediante localStorage
    const isInstalledFromStorage = localStorage.getItem("pwa_installed") === "true";
    
    // Método 2: Verificar si hay un manifest instalado (Chrome, Edge, Android)
    const isInstalledFromManifest = window.navigator.getInstalledRelatedApps ? 
      async () => {
        try {
          const relatedApps = await (navigator as any).getInstalledRelatedApps?.();
          return relatedApps && relatedApps.length > 0;
        } catch {
          return false;
        }
      } 
      : null;

    // Método 3: Verificar shortcut en iOS
    const isInstalledIOS = ios && localStorage.getItem("pwa_installed_ios") === "true";

    setIsInstalled(isInstalledFromStorage || isInstalledIOS);

    if (isInstalledFromManifest) {
      isInstalledFromManifest().then(installed => {
        if (installed) {
          setIsInstalled(true);
        }
      });
    }

    // Escuchar el evento beforeinstallprompt (Chrome, Edge, Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detectar cuando se instala la app
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      localStorage.setItem("pwa_installed", "true");
      setDeferredPrompt(null);
      setIsInstallable(false);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;

      if (result.outcome === "accepted") {
        localStorage.setItem("pwa_installed", "true");
        setIsInstalled(true);
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }

      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error("Error al instalar PWA:", error);
    }
  };

  const openApp = () => {
    // Abrir la PWA en la raíz
    window.location.href = "/";
  };

  const markAsInstalledIOS = () => {
    localStorage.setItem("pwa_installed", "true");
    localStorage.setItem("pwa_installed_ios", "true");
    setIsInstalled(true);
  };

  return {
    isInstallable,
    isInstalled,
    isPWA,
    isIOS,
    handleInstall,
    openApp,
    markAsInstalledIOS,
  };
};
