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
import { Client } from "@/types";

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSave: (client: Omit<Client, "id"> & { id?: string }) => void;
}

const ClientDialog = ({ open, onOpenChange, client, onSave }: ClientDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    dueDate: "",
    status: "pending" as Client["status"],
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        amount: client.amount.toString(),
        dueDate: client.dueDate,
        status: client.status,
        phone: client.phone || "",
        email: client.email || "",
      });
    } else {
      setFormData({
        name: "",
        amount: "",
        dueDate: "",
        status: "pending",
        phone: "",
        email: "",
      });
    }
  }, [client, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.amount || !formData.dueDate) {
      return;
    }

    onSave({
      ...(client?.id && { id: client.id }),
      name: formData.name,
      amount: parseFloat(formData.amount),
      dueDate: formData.dueDate,
      status: formData.status,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
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
              <Label htmlFor="amount" className="text-foreground">
                Monto Adeudado ($)
              </Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                required
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
              <Label htmlFor="status" className="text-foreground">
                Estado
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: Client["status"]) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="bg-muted/50 border-primary/20 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary/20 z-50">
                  <SelectItem value="pending" className="text-foreground hover:bg-primary/10">
                    Pendiente
                  </SelectItem>
                  <SelectItem value="paid" className="text-foreground hover:bg-primary/10">
                    Pagado
                  </SelectItem>
                  <SelectItem value="overdue" className="text-foreground hover:bg-primary/10">
                    Vencido
                  </SelectItem>
                </SelectContent>
              </Select>
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
