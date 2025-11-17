import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Smartphone, Sparkles, ExternalLink } from "lucide-react";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { IOSInstallInstructions } from "./IOSInstallInstructions";

export const InstallPWAButton = () => {
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const { 
    isIOS, 
    handleInstall, 
    isInstalled, 
    isPWA,
    openApp,
    markAsInstalledIOS
  } = useInstallPWA();

  // Si estamos dentro de la PWA (standalone mode), NO mostrar el cartel
  if (isPWA) {
    return null;
  }

  const handleIOSInstall = () => {
    setShowIOSInstructions(true);
  };

  const handleIOSInstructionsClose = (open: boolean) => {
    if (!open) {
      setShowIOSInstructions(false);
      // Marcar como instalada después de cerrar las instrucciones
      markAsInstalledIOS();
    }
  };

  const getInstallContent = () => {
    // Si está instalada, mostrar "Abrir App"
    if (isInstalled) {
      return {
        title: "Abrir App",
        description: "Abre tu aplicación instalada",
        buttonText: "Abrir",
        buttonIcon: ExternalLink,
        buttonAction: openApp,
        buttonDisabled: false,
        showSparkles: false,
        variant: "default" as const,
      };
    }

    // Si NO está instalada, mostrar "Instalar app"
    return {
      title: "Instalar app",
      description: null,
      buttonText: isIOS ? "Ver instrucciones" : "Instalar ahora",
      buttonIcon: Download,
      buttonAction: () => {
        if (isIOS) {
          handleIOSInstall();
        } else {
          handleInstall();
        }
      },
      buttonDisabled: false,
      showSparkles: true,
      variant: "default" as const,
    };
  };

  const content = getInstallContent();
  const ButtonIcon = content.buttonIcon;

  return (
    <>
      <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="p-4 relative">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 bg-primary/10 rounded-xl">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{content.title}</h3>
                {content.showSparkles && <Sparkles className="h-4 w-4 text-primary animate-pulse" />}
              </div>

              {content.description && (
                <p className="text-sm text-muted-foreground">{content.description}</p>
              )}

              <Button
                onClick={content.buttonAction}
                className="w-full sm:w-auto mt-2"
                size="sm"
                disabled={content.buttonDisabled}
                variant={content.variant}
              >
                <ButtonIcon className="h-4 w-4 mr-2" />
                {content.buttonText}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <IOSInstallInstructions 
        open={showIOSInstructions} 
        onOpenChange={handleIOSInstructionsClose}
      />
    </>
  );
};
