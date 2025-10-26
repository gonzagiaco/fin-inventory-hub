import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DeliveryNote, CreateDeliveryNoteInput } from "@/types";
import { useDeliveryNotes } from "@/hooks/useDeliveryNotes";
import DeliveryNoteProductSearch from "./DeliveryNoteProductSearch";
import { X, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

const deliveryNoteSchema = z.object({
  customerName: z.string().min(1, "Nombre requerido").max(100),
  customerAddress: z.string().max(200).optional(),
  customerPhone: z.string().max(20).optional(),
  issueDate: z.string().optional(),
  paidAmount: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: DeliveryNote;
}

interface CartItem {
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

const DeliveryNoteDialog = ({ open, onOpenChange, note }: DeliveryNoteDialogProps) => {
  const { createDeliveryNote, updateDeliveryNote } = useDeliveryNotes();
  const [items, setItems] = useState<CartItem[]>([]);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm({
    resolver: zodResolver(deliveryNoteSchema),
  });

  useEffect(() => {
    if (note) {
      setValue("customerName", note.customerName);
      setValue("customerAddress", note.customerAddress || "");
      setValue("customerPhone", note.customerPhone || "");
      setValue("issueDate", note.issueDate.split("T")[0]);
      setValue("paidAmount", note.paidAmount);
      setValue("notes", note.notes || "");
      
      setItems(note.items?.map(item => ({
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) || []);
    } else {
      reset();
      setItems([]);
    }
  }, [note, setValue, reset]);

  const handleAddProduct = (product: { id?: string; code: string; name: string; price: number }) => {
    const existingItem = items.find(i => i.productCode === product.code);
    
    if (existingItem) {
      setItems(items.map(i => 
        i.productCode === product.code 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setItems([...items, {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      }]);
    }
  };

  const handleRemoveItem = (code: string) => {
    setItems(items.filter(i => i.productCode !== code));
  };

  const handleUpdateQuantity = (code: string, delta: number) => {
    setItems(items.map(i => {
      if (i.productCode === code) {
        const newQuantity = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQuantity };
      }
      return i;
    }));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const onSubmit = async (data: any) => {
    if (items.length === 0) {
      toast.error("Debes agregar al menos un producto");
      return;
    }

    const input: CreateDeliveryNoteInput = {
      customerName: data.customerName,
      customerAddress: data.customerAddress,
      customerPhone: data.customerPhone,
      issueDate: data.issueDate || new Date().toISOString(),
      paidAmount: data.paidAmount || 0,
      notes: data.notes,
      items,
    };

    try {
      if (note) {
        await updateDeliveryNote({ id: note.id, ...input });
      } else {
        await createDeliveryNote(input);
      }
      onOpenChange(false);
      reset();
      setItems([]);
    } catch (error) {
      console.error("Error saving delivery note:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{note ? "Editar Remito" : "Nuevo Remito"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName">Nombre del Cliente *</Label>
              <Input id="customerName" {...register("customerName")} />
              {errors.customerName && (
                <p className="text-sm text-red-500">{errors.customerName.message as string}</p>
              )}
            </div>
            <div>
              <Label htmlFor="customerPhone">Teléfono</Label>
              <Input id="customerPhone" {...register("customerPhone")} />
            </div>
          </div>

          <div>
            <Label htmlFor="customerAddress">Dirección</Label>
            <Input id="customerAddress" {...register("customerAddress")} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issueDate">Fecha de Emisión</Label>
              <Input type="date" id="issueDate" {...register("issueDate")} />
            </div>
            <div>
              <Label htmlFor="paidAmount">Monto Pagado</Label>
              <Input
                type="number"
                step="0.01"
                id="paidAmount"
                {...register("paidAmount", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>

          <div>
            <Label>Agregar Productos</Label>
            <DeliveryNoteProductSearch onSelect={handleAddProduct} />
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Productos Seleccionados</Label>
              <div className="border rounded-lg divide-y">
                {items.map((item) => (
                  <div key={item.productCode} className="p-3 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        Código: {item.productCode} | ${item.unitPrice.toFixed(2)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateQuantity(item.productCode, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center">{item.quantity}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateQuantity(item.productCode, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <span className="w-20 text-right font-medium">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveItem(item.productCode)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end items-center gap-4 pt-2 border-t">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {note ? "Actualizar" : "Crear"} Remito
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryNoteDialog;
