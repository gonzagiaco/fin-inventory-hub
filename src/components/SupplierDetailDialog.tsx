import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Supplier } from "@/types";
import { SupplierProductLists } from "./SupplierProductLists";

interface SupplierDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
}

const SupplierDetailDialog = ({
  open,
  onOpenChange,
  supplier,
}: SupplierDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/20 max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-3">
            {supplier.logo && (
              <img
                src={supplier.logo}
                alt={supplier.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            {supplier.name} - Listas de Productos
          </DialogTitle>
        </DialogHeader>

        <SupplierProductLists supplierId={supplier.id} supplierName={supplier.name} />
      </DialogContent>
    </Dialog>
  );
};

export default SupplierDetailDialog;
