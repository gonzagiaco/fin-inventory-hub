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
import { Textarea } from "@/components/ui/textarea";
import { Client, StockItem, InvoiceProduct } from "@/types";
import ProductSelector from "./ProductSelector";

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSave: (client: Omit<Client, "id"> & { id?: string }) => void;
  stockItems: StockItem[];
}

const ClientDialog = ({ open, onOpenChange, client, onSave, stockItems }: ClientDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    dueDate: "",
    phone: "",
    email: "",
    address: "",
  });
  const [selectedProducts, setSelectedProducts] = useState<InvoiceProduct[]>([]);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        dueDate: client.dueDate,
        phone: client.phone || "",
        email: client.email || "",
        address: client.address || "",
      });
      setSelectedProducts(client.products || []);
    } else {
      setFormData({
        name: "",
        dueDate: new Date().toLocaleDateString("es-AR"),
        phone: "",
        email: "",
        address: "",
      });
      setSelectedProducts([]);
    }
  }, [client, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.dueDate || selectedProducts.length === 0) {
      return;
    }

    const total = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
    const remainingAmount = client ? total - client.amountPaid : total;

    onSave({
      ...(client?.id && { id: client.id }),
      name: formData.name,
      amount: total,
      amountPaid: client?.amountPaid || 0,
      dueDate: formData.dueDate,
      status: client?.status || "pending",
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      address: formData.address || undefined,
      products: selectedProducts,
      payments: client?.payments || [],
      issueDate: client?.issueDate || new Date().toLocaleDateString("es-AR"),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {client ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {client
              ? "Modifica los datos del cliente deudor"
              : "Agrega un nuevo cliente deudor"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-foreground">
                Nombre Completo
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
              <Label htmlFor="address" className="text-foreground">
                Dirección
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate" className="text-foreground">
                Fecha de Vencimiento
              </Label>
              <Input
                id="dueDate"
                type="text"
                placeholder="DD/MM/YYYY"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone" className="text-foreground">
                Teléfono (opcional)
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground">
                Email (opcional)
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
              />
            </div>
            
            <div className="border-t border-primary/20 pt-4">
              <ProductSelector
                stockItems={stockItems}
                selectedProducts={selectedProducts}
                onChange={setSelectedProducts}
              />
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
              {client ? "Guardar Cambios" : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDialog;
