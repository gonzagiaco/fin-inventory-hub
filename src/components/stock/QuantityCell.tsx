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
};

export const QuantityCell: React.FC<Props> = ({
  productId,
  listId,
  value,
  onLocalUpdate,
}) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const current = Number(value ?? 0);

  const handleCommit = async (raw: string) => {
    const newQty = Number(raw);
    if (Number.isNaN(newQty) || newQty === current) return;

    try {
      if (isOnline) {
        // Modo online: actualizar Supabase directamente
        const { error } = await supabase
          .from("dynamic_products_index")
          .update({ quantity: newQty })
          .eq("product_id", productId);

        if (error) throw error;
        toast.success("Stock actualizado");
      } else {
        // Modo offline: guardar en IndexedDB y encolar
        await updateProductQuantityOffline(productId, listId, newQty);
        toast.success("Stock actualizado (se sincronizará al reconectar)");
      }

      // Actualización optimista de UI
      onLocalUpdate?.(newQty);

      // Invalidar queries (tanto online como offline)
      queryClient.invalidateQueries({ queryKey: ["global-search"] });
      queryClient.invalidateQueries({ queryKey: ["list-products", listId] });
    } catch (error: any) {
      console.error("Error al actualizar stock:", error);
      toast.error(`Error al actualizar stock: ${error.message}`);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      (e.target as HTMLInputElement).value = String(current);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="number"
      className="h-8 w-24 bg-black border rounded px-2"
      defaultValue={current}
      onBlur={(e) => { void handleCommit(e.target.value); }}
      onKeyDown={onKeyDown}
    />
  );
};
