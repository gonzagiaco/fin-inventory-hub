import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share, Plus, Smartphone } from "lucide-react";

interface IOSInstallInstructionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const IOSInstallInstructions = ({ open, onOpenChange }: IOSInstallInstructionsProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar App en iOS
          </DialogTitle>
          <DialogDescription>
            Sigue estos pasos para instalar la app en tu dispositivo iOS
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Toca el botón de compartir</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Share className="h-4 w-4" />
                <span>Busca el ícono de compartir en Safari (abajo en el centro)</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              2
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Selecciona "Añadir a pantalla de inicio"</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Plus className="h-4 w-4" />
                <span>Busca esta opción en el menú que aparece</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Confirma la instalación</p>
              <p className="text-sm text-muted-foreground">
                Toca "Agregar" en la esquina superior derecha
              </p>
            </div>
          </div>

          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> Una vez instalada, podrás acceder a la app desde tu pantalla de inicio como cualquier otra aplicación, ¡incluso sin conexión!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
