import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StockItem } from "@/types";

interface StockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: StockItem | null;
  onSave: (item: Omit<StockItem, "id"> & { id?: string }) => void;
}

const categories = ["Fruits", "Bakery", "Dairy", "Produce"];

const StockDialog = ({ open, onOpenChange, item, onSave }: StockDialogProps) => {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    quantity: "",
    category: "Fruits",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code,
        name: item.name,
        quantity: item.quantity.toString(),
        category: item.category,
      });
    } else {
      setFormData({
        code: "",
        name: "",
        quantity: "",
        category: "Fruits",
      });
    }
  }, [item, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name || !formData.quantity) {
      return;
    }

    onSave({
      ...(item?.id && { id: item.id }),
      code: formData.code,
      name: formData.name,
      quantity: parseInt(formData.quantity),
      category: formData.category,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {item ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {item
              ? "Modifica los datos del producto en el inventario"
              : "Agrega un nuevo producto al inventario"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code" className="text-foreground">
                Código
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-foreground">
                Nombre
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantity" className="text-foreground">
                Cantidad
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category" className="text-foreground">
                Categoría
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="bg-muted/50 border-primary/20 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary/20 z-50">
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-foreground hover:bg-primary/10">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-primary/20 text-foreground hover:bg-primary/10"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {item ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StockDialog;
