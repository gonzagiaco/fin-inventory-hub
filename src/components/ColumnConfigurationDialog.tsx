import { useState } from "react";
import { Settings2, Plus, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ColumnSchema } from "@/types/productList";
import { useProductListStore } from "@/stores/productListStore";
import { useProductLists } from "@/hooks/useProductLists";
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
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnKey, setNewColumnKey] = useState("");
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [newColumnType, setNewColumnType] = useState<"text" | "number" | "date">("text");
  const [newColumnDefault, setNewColumnDefault] = useState("");
  const {
    quantityColumn,
    priceColumn,
    lowStockThreshold,
    setQuantityColumn,
    setPriceColumn,
    setLowStockThreshold,
  } = useProductListStore();

  const { updateColumnSchema } = useProductLists();

  const currentQuantityColumn = quantityColumn[listId] || "quantity";
  const currentPriceColumn = priceColumn[listId] || "price";
  const currentThreshold = lowStockThreshold[listId] || 50;

  const handleSave = () => {
    toast.success("Configuración guardada correctamente");
    setOpen(false);
  };

  const handleAddColumn = async () => {
    if (!newColumnKey || !newColumnLabel) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    // Validate key format (lowercase, no spaces)
    const sanitizedKey = newColumnKey.toLowerCase().replace(/\s+/g, "_");
    
    // Check if key already exists
    if (columnSchema.some(col => col.key === sanitizedKey)) {
      toast.error("Ya existe una columna con ese nombre");
      return;
    }

    try {
      const updatedSchema: ColumnSchema[] = [
        ...columnSchema,
        {
          key: sanitizedKey,
          label: newColumnLabel,
          type: newColumnType,
          visible: true,
          order: columnSchema.length,
          isStandard: false,
        }
      ];

      await updateColumnSchema({ listId, columnSchema: updatedSchema });
      
      // Reset form
      setNewColumnKey("");
      setNewColumnLabel("");
      setNewColumnType("text");
      setNewColumnDefault("");
      setIsAddingColumn(false);
      
      toast.success("Columna agregada exitosamente");
    } catch (error) {
      console.error("Error adding column:", error);
      toast.error("Error al agregar columna");
    }
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

          <Separator />

          {/* Add New Column Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Gestionar Columnas</Label>
              {!isAddingColumn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingColumn(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Columna
                </Button>
              )}
            </div>

            {isAddingColumn && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                <div className="space-y-2">
                  <Label>Nombre Interno (sin espacios)</Label>
                  <Input
                    value={newColumnKey}
                    onChange={(e) => setNewColumnKey(e.target.value)}
                    placeholder="ej: stock_disponible"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usará internamente. Se convertirá a minúsculas sin espacios.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Etiqueta Visible</Label>
                  <Input
                    value={newColumnLabel}
                    onChange={(e) => setNewColumnLabel(e.target.value)}
                    placeholder="ej: Stock Disponible"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este será el nombre que se mostrará en la tabla
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Dato</Label>
                  <Select value={newColumnType} onValueChange={(value: any) => setNewColumnType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="date">Fecha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor por Defecto (Opcional)</Label>
                  <Input
                    type={newColumnType === "number" ? "number" : "text"}
                    value={newColumnDefault}
                    onChange={(e) => setNewColumnDefault(e.target.value)}
                    placeholder="Valor inicial para productos existentes"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dejar vacío si prefieres completarlo manualmente
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddColumn} className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Columna
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingColumn(false);
                      setNewColumnKey("");
                      setNewColumnLabel("");
                      setNewColumnType("text");
                      setNewColumnDefault("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Las nuevas columnas aparecerán vacías en productos existentes. Podrás editarlas manualmente en cada producto.
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
