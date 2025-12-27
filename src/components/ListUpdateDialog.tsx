import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ListUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableLists: ProductList[];
  newProductCount: number;
  onUpdate: (listId: string) => void;
  onCreateNew: () => void;
  isUpdating?: boolean;
}

export function ListUpdateDialog({
  open,
  onOpenChange,
  availableLists,
  newProductCount,
  onUpdate,
  onCreateNew,
  isUpdating = false,
}: ListUpdateDialogProps) {
  const [selectedListId, setSelectedListId] = useState<string>("");

  if (availableLists.length === 0) return null;

  const selectedList = availableLists.find(list => list.id === selectedListId);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isUpdating) return;
    onOpenChange(nextOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Actualizar o Crear Nueva Lista</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-2">
            <p>
              Se encontraron {availableLists.length} lista{availableLists.length > 1 ? 's' : ''} existente{availableLists.length > 1 ? 's' : ''} para este proveedor.
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Selecciona una lista para actualizar:
              </label>
              <Select value={selectedListId} onValueChange={setSelectedListId} disabled={isUpdating}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir lista..." />
                </SelectTrigger>
                <SelectContent>
                  {availableLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{list.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {list.productCount} productos • {list.fileType.toUpperCase()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedList && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="font-medium text-foreground">{selectedList.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {selectedList.fileType.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedList.productCount} productos actuales
                  </span>
                  <span className="text-xs text-muted-foreground">
                    → {newProductCount} productos nuevos
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Última actualización: {new Date(selectedList.updatedAt).toLocaleDateString('es-AR')}
                </div>
              </div>
            )}

            <p className="text-sm">
              ¿Deseas <strong className="text-foreground">actualizar</strong> la lista seleccionada con los nuevos datos
              o <strong className="text-foreground">crear una nueva lista</strong>?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCreateNew} disabled={isUpdating}>
            Crear Nueva Lista
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => selectedListId && onUpdate(selectedListId)} 
            disabled={!selectedListId || isUpdating}
            className="bg-primary"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Actualizando...
              </>
            ) : (
              "Actualizar Seleccionada"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
