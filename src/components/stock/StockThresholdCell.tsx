import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { updateProductThresholdOffline } from "@/lib/localDB";

type Props = {
  productId: string;
  listId: string;
  value: number | null | undefined;
  onLocalUpdate?: (newThreshold: number) => void;
  onOptimisticUpdate?: (newThreshold: number) => void;
};

export const StockThresholdCell: React.FC<Props> = ({
  productId,
  listId,
  value,
  onLocalUpdate,
  onOptimisticUpdate,
}) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const current = Number(value ?? 0);

  const handleCommit = async (raw: string) => {
    const parsed = Number(raw);
    const next = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    if (next === current) return;

    onOptimisticUpdate?.(next);
    onLocalUpdate?.(next);

    toast.success(
      isOnline
        ? "Stock mínimo actualizado"
        : "Stock mínimo actualizado (se sincronizará al reconectar)",
    );

    queueMicrotask(async () => {
      try {
        const updateData = {
          stock_threshold: next,
          updated_at: new Date().toISOString(),
        };

        if (isOnline) {
          const [{ error: indexError }, { error: productError }] =
            await Promise.all([
              supabase
                .from("dynamic_products_index")
                .update(updateData)
                .eq("product_id", productId),
              supabase
                .from("dynamic_products")
                .update(updateData)
                .eq("id", productId),
            ]);

          if (indexError) throw indexError;
          if (productError) throw productError;
        }

        await updateProductThresholdOffline(productId, listId, next);
        queryClient.invalidateQueries({ queryKey: ["list-products", listId] });
        queryClient.invalidateQueries({ queryKey: ["my-stock"] });
        queryClient.invalidateQueries({ queryKey: ["global-search"] });
      } catch (error: any) {
        console.error("Error al actualizar stock mínimo:", error);
        toast.error(`Error al actualizar stock mínimo: ${error.message}`);
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
    <input
      type="number"
      min={0}
      className="h-8 w-20 lg-1160:w-16 bg-black border rounded px-2"
      defaultValue={current}
      onBlur={(e) => {
        void handleCommit(e.target.value);
      }}
      onKeyDown={onKeyDown}
    />
  );
};
