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
import { X, Plus, Minus, Loader2 } from "lucide-react";
import { formatARS } from "@/utils/numberParser";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const deliveryNoteSchema = z.object({
  customerName: z.string().min(1, "Nombre requerido").max(100),
  customerAddress: z.string().max(200).optional(),
  customerPhone: z.string()
    .regex(/^\+54\d{10}$/, "Formato inválido. Debe ser +54 seguido de 10 dígitos")
    .optional()
    .or(z.literal("")),
  issueDate: z.string().min(1, "Fecha de emisión requerida"),
  paidAmount: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: DeliveryNote;
  isLoadingNote?: boolean;
}

interface CartItem {
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

const DeliveryNoteDialog = ({ open, onOpenChange, note, isLoadingNote = false }: DeliveryNoteDialogProps) => {
  const { createDeliveryNote, updateDeliveryNote } = useDeliveryNotes();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm({
    resolver: zodResolver(deliveryNoteSchema),
  });

  useEffect(() => {
    if (note) {
      setValue("customerName", note.customerName);
      setValue("customerAddress", note.customerAddress || "");
      setValue("customerPhone", note.customerPhone || "");
      setPhoneNumber(note.customerPhone || "");
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

  const handleAddProduct = async (product: { id?: string; code: string; name: string; price: number }) => {
    // 🔧 NUEVO: Validar stock disponible
    if (product.id) {
      const { data: indexProduct, error } = await supabase
        .from("dynamic_products_index")
        .select("quantity")
        .eq("product_id", product.id)
        .single();

      if (error) {
        console.error("Error al verificar stock:", error);
      } else if (indexProduct) {
        const availableStock = indexProduct.quantity || 0;
        
        // Verificar si ya está en la lista
        const existingItem = items.find(i => i.productCode === product.code);
        const currentQuantity = existingItem ? existingItem.quantity : 0;
        
        if (availableStock <= 0) {
          toast.error(`⚠️ ${product.name} no tiene stock disponible`);
          return;
        }
        
        if (currentQuantity + 1 > availableStock) {
          toast.warning(
            `⚠️ Stock limitado: solo quedan ${availableStock} unidades de ${product.name}`
          );
        }
      }
    }

    const existingItem = items.find(i => i.productCode === product.code);
    
    if (existingItem) {
      setItems(items.map(i => 
        i.productCode === product.code 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
      toast.success(`Cantidad aumentada: ${product.name}`);
    } else {
      setItems([...items, {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      }]);
      toast.success(`Producto agregado: ${product.name}`);
    }
  };

  const handleRemoveItem = (code: string) => {
    if (items.length === 1) {
      toast.warning("Debes mantener al menos un producto en el remito");
      return;
    }
    
    setItems(items.filter(i => i.productCode !== code));
    toast.success("Producto eliminado del remito");
  };

  const handleUpdateQuantity = async (code: string, delta: number) => {
    const item = items.find(i => i.productCode === code);
    if (!item) return;

    const newQuantity = item.quantity + delta;
    
    if (newQuantity < 1) {
      toast.error("La cantidad debe ser al menos 1");
      return;
    }

    // 🔧 NUEVO: Validar stock disponible al aumentar
    if (delta > 0 && item.productId) {
      const { data: indexProduct } = await supabase
        .from("dynamic_products_index")
        .select("quantity")
        .eq("product_id", item.productId)
        .single();

      if (indexProduct) {
        const availableStock = indexProduct.quantity || 0;
        
        if (newQuantity > availableStock) {
          toast.error(
            `⚠️ Stock insuficiente: solo hay ${availableStock} unidades disponibles`
          );
          return;
        }
      }
    }

    setItems(items.map(i => {
      if (i.productCode === code) {
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

    // 🔧 NUEVO: Validar stock total antes de crear/actualizar
    const stockErrors: string[] = [];
    
    for (const item of items) {
      if (item.productId) {
        const { data: indexProduct } = await supabase
          .from("dynamic_products_index")
          .select("quantity")
          .eq("product_id", item.productId)
          .single();

        if (indexProduct) {
          const availableStock = indexProduct.quantity || 0;
          
          if (item.quantity > availableStock) {
            stockErrors.push(
              `${item.productName}: necesitas ${item.quantity} pero solo hay ${availableStock}`
            );
          }
        }
      }
    }

    if (stockErrors.length > 0) {
      toast.error("Stock insuficiente", {
        description: stockErrors.join("\n"),
      });
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
      setIsSubmitting(true);

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
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si estamos cargando los datos del remito, mostrar skeleton
  if (isLoadingNote) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl min-h-[80vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cargando remito...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl min-h-[80vh] max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="customerPhone">Teléfono (WhatsApp)</Label>
              <div className="flex gap-2">
                <div className="flex items-center bg-muted px-3 rounded-md border">
                  <span className="text-sm font-medium">+54</span>
                </div>
                <Input
                  id="customerPhone"
                  placeholder="1112345678"
                  type="tel"
                  maxLength={10}
                  value={phoneNumber.replace("+54", "")}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    const fullNumber = digits ? `+54${digits}` : "";
                    setPhoneNumber(fullNumber);
                    setValue("customerPhone", fullNumber);
                  }}
                />
              </div>
              {errors.customerPhone && (
                <p className="text-sm text-red-500">{errors.customerPhone.message as string}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="customerAddress">Dirección</Label>
            <Input id="customerAddress" {...register("customerAddress")} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issueDate">Fecha de Emisión *</Label>
              <Input 
                type="date" 
                id="issueDate" 
                {...register("issueDate")}
                defaultValue={new Date().toISOString().split('T')[0]}
              />
              {errors.issueDate && (
                <p className="text-sm text-red-500">{errors.issueDate.message as string}</p>
              )}
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
                        Código: {item.productCode} | {formatARS(item.unitPrice)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
                      <div className="flex items-center">
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
                      </div>
                      <span className="w-28 text-right font-medium whitespace-nowrap">
                        {formatARS(item.quantity * item.unitPrice)}
                      </span>

                      </div>
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
                  {formatARS(calculateTotal())}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {note ? "Actualizando..." : "Creando..."}
                </>
              ) : (
                note ? "Actualizar Remito" : "Crear Remito"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryNoteDialog;
