import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Smartphone, Sparkles } from "lucide-react";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { IOSInstallInstructions } from "./IOSInstallInstructions";

export const InstallPWAButton = () => {
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const { isIOS, handleInstall, isInstalled, isPWA } = useInstallPWA();

  // Si estamos dentro de la PWA, NO mostrar el cartel
  if (isPWA) {
    return null;
  }

  const getInstallContent = () => {
    // Si está instalada (hay flag), mostrar "Ya instalada"
    if (isInstalled) {
      return {
        title: "Ya instalada",
        description: "La app ya está instalada en tu dispositivo",
        buttonText: "Instalada",
        buttonAction: () => {}, // No hace nada
        buttonDisabled: true,
        showSparkles: false,
      };
    }

    // Si NO está instalada, mostrar "Instalar ahora"
    return {
      title: "Instalar app",
      description: null,
      buttonText: isIOS ? "Ver instrucciones" : "Instalar ahora",
      buttonAction: () => {
        if (isIOS) {
          setShowIOSInstructions(true);
        } else {
          handleInstall();
        }
      },
      buttonDisabled: false,
      showSparkles: true,
    };
  };

  const content = getInstallContent();

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
                {content.showSparkles && <Sparkles className="h-4 w-4 text-primary" />}
              </div>

              {content.description && <p className="text-sm text-muted-foreground">{content.description}</p>}

              <Button
                onClick={content.buttonAction}
                className="w-full sm:w-auto mt-2"
                size="sm"
                disabled={content.buttonDisabled}
              >
                <Download className="h-4 w-4 mr-2" />
                {content.buttonText}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <IOSInstallInstructions open={showIOSInstructions} onOpenChange={setShowIOSInstructions} />
    </>
  );
};
