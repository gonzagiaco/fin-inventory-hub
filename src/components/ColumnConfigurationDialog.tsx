import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ColumnSchema } from "@/types/productList";
import { useProductListStore } from "@/stores/productListStore";
import { toast } from "sonner";

interface ColumnConfigurationDialogProps {
  listId: string;
  columnSchema: ColumnSchema[];
}

export function ColumnConfigurationDialog({
  listId,
  columnSchema,
}: ColumnConfigurationDialogProps) {
  const [open, setOpen] = useState(false);
  const {
    quantityColumn,
    priceColumn,
    lowStockThreshold,
    setQuantityColumn,
    setPriceColumn,
    setLowStockThreshold,
  } = useProductListStore();

  const currentQuantityColumn = quantityColumn[listId] || "quantity";
  const currentPriceColumn = priceColumn[listId] || "price";
  const currentThreshold = lowStockThreshold[listId] || 50;

  const handleSave = () => {
    toast.success("Configuración guardada correctamente");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Configurar Columnas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configuración de Columnas</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Quantity Column */}
          <div className="space-y-2">
            <Label>Columna de Cantidad</Label>
            <Select
              value={currentQuantityColumn}
              onValueChange={(value) => setQuantityColumn(listId, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar columna" />
              </SelectTrigger>
              <SelectContent>
                {columnSchema.map((col) => (
                  <SelectItem key={col.key} value={col.key}>
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Esta columna se utilizará para determinar la cantidad en stock
            </p>
          </div>

          {/* Low Stock Threshold */}
          <div className="space-y-2">
            <Label>Umbral de Bajo Stock</Label>
            <Input
              type="number"
              value={currentThreshold}
              onChange={(e) => setLowStockThreshold(listId, Number(e.target.value))}
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Los productos con cantidad menor a este valor se marcarán en rojo
            </p>
          </div>

          {/* Price Column */}
          <div className="space-y-2">
            <Label>Columna de Precio</Label>
            <Select
              value={currentPriceColumn}
              onValueChange={(value) => setPriceColumn(listId, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar columna" />
              </SelectTrigger>
              <SelectContent>
                {columnSchema.map((col) => (
                  <SelectItem key={col.key} value={col.key}>
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Esta columna se utilizará como precio al agregar a la lista de pedidos
            </p>
          </div>

          <Button onClick={handleSave} className="w-full">
            Guardar Configuración
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
