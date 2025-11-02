import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  const current = Number(value ?? 0);

  const handleCommit = async (raw: string) => {
    const newQty = Number(raw);
    if (Number.isNaN(newQty) || newQty === current) return;

    const { error } = await supabase
      .from("dynamic_products_index")
      .update({ quantity: newQty })
      .eq("product_id", productId);

    if (error) {
      toast.error("Error al actualizar stock");
      return;
    }

    // Update optimista opcional (para tablas que pasan onLocalUpdate)
    onLocalUpdate?.(newQty);

    // Invalidar búsquedas y listas paginadas
    queryClient.invalidateQueries({ queryKey: ["global-search"] });
    queryClient.invalidateQueries({ queryKey: ["list-products", listId] });

    toast.success("Stock actualizado");
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
