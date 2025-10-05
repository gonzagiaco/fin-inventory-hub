import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StockItem } from "@/types";

export const useStock = () => {
  const queryClient = useQueryClient();

  const { data: stockItems = [], isLoading } = useQuery({
    queryKey: ["stock-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Convert snake_case to camelCase
      return (data || []).map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        costPrice: item.cost_price,
        supplierId: item.supplier_id,
        specialDiscount: item.special_discount,
        minStockLimit: item.min_stock_limit,
      })) as StockItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: Omit<StockItem, "id">) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("stock_items")
        .insert([{
          user_id: userData.user?.id,
          code: item.code,
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          cost_price: item.costPrice,
          supplier_id: item.supplierId,
          special_discount: item.specialDiscount,
          min_stock_limit: item.minStockLimit,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Producto agregado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al agregar producto");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...item }: Partial<StockItem> & { id: string }) => {
      const updates: any = {};
      
      if (item.code !== undefined) updates.code = item.code;
      if (item.name !== undefined) updates.name = item.name;
      if (item.quantity !== undefined) updates.quantity = item.quantity;
      if (item.category !== undefined) updates.category = item.category;
      if (item.costPrice !== undefined) updates.cost_price = item.costPrice;
      if (item.supplierId !== undefined) updates.supplier_id = item.supplierId;
      if (item.specialDiscount !== undefined) updates.special_discount = item.specialDiscount;
      if (item.minStockLimit !== undefined) updates.min_stock_limit = item.minStockLimit;

      const { data, error } = await supabase
        .from("stock_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Producto actualizado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar producto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Producto eliminado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar producto");
    },
  });

  return {
    stockItems,
    isLoading,
    createItem: createMutation.mutate,
    updateItem: updateMutation.mutate,
    deleteItem: deleteMutation.mutate,
  };
};