import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ProductList } from "@/types/productList";

interface ListUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingList: ProductList | null;
  newProductCount: number;
  onUpdate: () => void;
  onCreateNew: () => void;
}

export function ListUpdateDialog({
  open,
  onOpenChange,
  existingList,
  newProductCount,
  onUpdate,
  onCreateNew,
}: ListUpdateDialogProps) {
  if (!existingList) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Lista Similar Detectada</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p>
              Se encontró una lista existente con estructura similar:
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="font-medium text-foreground">{existingList.name}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {existingList.fileType.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {existingList.productCount} productos actuales
                </span>
                <span className="text-xs text-muted-foreground">
                  → {newProductCount} productos nuevos
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Última actualización: {new Date(existingList.updatedAt).toLocaleDateString('es-AR')}
              </div>
            </div>
            <p className="text-sm">
              ¿Deseas <strong className="text-foreground">actualizar</strong> la lista existente con los nuevos datos
              o <strong className="text-foreground">crear una nueva lista</strong>?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCreateNew}>
            Crear Nueva Lista
          </AlertDialogCancel>
          <AlertDialogAction onClick={onUpdate} className="bg-primary">
            Actualizar Existente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
