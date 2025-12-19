import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { updateProductQuantityOffline } from "@/lib/localDB";

type Props = {
  productId: string;
  listId: string;
  value: number | null | undefined;
  /** Opcional: para actualizar inmediatamente la UI del padre (ej. row.original.quantity) */
  onLocalUpdate?: (newQty: number) => void;
  /** Callback para actualización optimista inmediata */
  onOptimisticUpdate?: (newQty: number) => void;
  visibleSpan: boolean;
};

export const QuantityCell: React.FC<Props> = ({
  productId,
  listId,
  value,
  onLocalUpdate,
  onOptimisticUpdate,
  visibleSpan
}) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const current = Number(value ?? 0);

  const handleCommit = async (raw: string) => {
    const newQty = Number(raw);
    if (Number.isNaN(newQty) || newQty === current) return;

    // 1. Actualización optimista INMEDIATA
    onOptimisticUpdate?.(newQty);
    onLocalUpdate?.(newQty);

    // 2. Toast
    toast.success(isOnline ? "Stock actualizado" : "Stock actualizado (se sincronizará al reconectar)");

    // 3. Backend en segundo plano
    queueMicrotask(async () => {
      try {
        // Preparar datos de actualización - si quantity > 0, agregar a Mi Stock
        const updateData: { quantity: number; in_my_stock?: boolean; updated_at: string } = {
          quantity: newQty,
          updated_at: new Date().toISOString(),
        };
        
        if (newQty > 0) {
          updateData.in_my_stock = true;
        }

        if (isOnline) {
          const { error } = await supabase
            .from("dynamic_products_index")
            .update(updateData)
            .eq("product_id", productId);

          if (error) throw error;
        }
        
        await updateProductQuantityOffline(productId, listId, newQty);
        queryClient.invalidateQueries({ queryKey: ["global-search"] });
        queryClient.invalidateQueries({ queryKey: ["list-products", listId] });
        queryClient.invalidateQueries({ queryKey: ["my-stock"] });
      } catch (error: any) {
        console.error("Error al actualizar stock:", error);
        toast.error(`Error al actualizar stock: ${error.message}`);
      }
    });
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      (e.target as HTMLInputElement).value = String(current);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <>
    <input
      type="number"
      className="h-8 w-20 lg-1160:w-16  bg-black border rounded px-2"
      defaultValue={current}
      onBlur={(e) => { void handleCommit(e.target.value); }}
      onKeyDown={onKeyDown}
    />
    
    </>
  );
};
