import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Supplier } from "@/types";
import { toast } from "@/hooks/use-toast";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (supplier: Omit<Supplier, "id"> & { id?: string }) => void;
  supplier?: Supplier | null;
}

const SupplierDialog = ({
  open,
  onOpenChange,
  onSave,
  supplier,
}: SupplierDialogProps) => {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setLogo(supplier.logo || "");
    } else {
      setName("");
      setLogo("");
    }
  }, [supplier, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del proveedor es obligatorio",
        variant: "destructive",
      });
      return;
    }

    const supplierData = supplier?.id 
      ? {
          id: supplier.id,
          name: name.trim(),
          logo: logo.trim() || undefined,
        }
      : {
          name: name.trim(),
          logo: logo.trim() || undefined,
        };

    onSave(supplierData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {supplier ? "Editar Proveedor" : "Nuevo Proveedor"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Nombre *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del proveedor"
              className="bg-background border-primary/20 text-foreground"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo" className="text-foreground">
              Logo URL
            </Label>
            <Input
              id="logo"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://ejemplo.com/logo.png"
              className="bg-background border-primary/20 text-foreground"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-primary/20"
            >
              Cancelar
            </Button>
            <Button type="submit">
              {supplier ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierDialog;
