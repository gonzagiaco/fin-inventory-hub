import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Smartphone, X, Sparkles } from "lucide-react";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { IOSInstallInstructions } from "./IOSInstallInstructions";

export const InstallPWAButton = () => {
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const { isIOS, handleInstall, handleDismiss, shouldShowInstallPrompt } = useInstallPWA();

  if (!shouldShowInstallPrompt()) {
    return null;
  }

  const handleClick = () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      handleInstall();
    }
  };

  return (
    <>
      <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="p-4 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 bg-primary/10 rounded-xl">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Instalar app</h3>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>

              <Button onClick={handleClick} className="w-full sm:w-auto mt-2" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {isIOS ? "Ver instrucciones" : "Instalar ahora"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <IOSInstallInstructions open={showIOSInstructions} onOpenChange={setShowIOSInstructions} />
    </>
  );
};
