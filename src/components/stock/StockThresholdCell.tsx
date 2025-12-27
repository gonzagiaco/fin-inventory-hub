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
  suppressToasts?: boolean;
};

export const StockThresholdCell: React.FC<Props> = ({
  productId,
  listId,
  value,
  onLocalUpdate,
  onOptimisticUpdate,
  suppressToasts,
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

    if (!suppressToasts) {
      toast.success(
        isOnline
          ? "Stock minimo actualizado"
          : "Stock minimo actualizado (se sincronizara al reconectar)",
      );
    }

    queueMicrotask(async () => {
      try {
        const updateData = {
          stock_threshold: next,
          updated_at: new Date().toISOString(),
        };

        if (isOnline) {
          const { error: indexError } = await supabase
            .from("dynamic_products_index")
            .update(updateData)
            .eq("product_id", productId);

          if (indexError) throw indexError;

          const { error: productError } = await supabase
            .from("dynamic_products")
            .update(updateData)
            .eq("id", productId);

          if (
            productError &&
            !productError.message
              ?.toLowerCase()
              .includes("stock_threshold")
          ) {
            throw productError;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const { error: myStockError } = await supabase
              .from("my_stock_products")
              .update({ stock_threshold: next, updated_at: updateData.updated_at })
              .eq("user_id", user.id)
              .eq("product_id", productId);

            if (myStockError) throw myStockError;
          }
        }

        await updateProductThresholdOffline(productId, listId, next, { enqueue: !isOnline });
        queryClient.invalidateQueries({ queryKey: ["list-products", listId] });
        queryClient.invalidateQueries({ queryKey: ["my-stock"] });
        queryClient.invalidateQueries({ queryKey: ["global-search"] });
      } catch (error: any) {
        console.error("Error al actualizar stock minimo:", error);
        if (!suppressToasts) {
          toast.error(`Error al actualizar stock minimo: ${error.message}`);
        }
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
