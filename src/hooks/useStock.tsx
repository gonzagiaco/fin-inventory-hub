import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StockItem } from "@/types";
import { useOnlineStatus } from './useOnlineStatus';
import {
  createStockItemOffline,
  updateStockItemOffline,
  deleteStockItemOffline,
  getOfflineData,
  localDB
} from '@/lib/localDB';

export const useStock = () => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const { data: stockItems = [], isLoading } = useQuery({
    queryKey: ["stock-items"],
    queryFn: async () => {
      if (!isOnline) {
        const offlineData = await getOfflineData('stock_items') as any[];
        return (offlineData || []).map((item) => ({
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
      }

      const { data, error } = await supabase
        .from("stock_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
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
      const { data: userData, error: authError } = await supabase.auth.getUser();
      
      if (authError || !userData.user) {
        throw new Error("Usuario no autenticado");
      }
      
      if (!isOnline) {
        const id = await createStockItemOffline({
          user_id: userData.user.id,
          code: item.code,
          name: item.name,
          quantity: item.quantity || 0,
          category: item.category,
          cost_price: item.costPrice,
          supplier_id: item.supplierId,
          special_discount: item.specialDiscount || false,
          min_stock_limit: item.minStockLimit || 0,
        });
        return { id, ...item };
      }

      const { data, error } = await supabase
        .from("stock_items")
        .insert([{
          user_id: userData.user.id,
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
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("No se pudo crear el producto");
      
      // Escribir inmediatamente en IndexedDB
      await localDB.stock_items.add(data);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success(
        isOnline
          ? "Producto agregado exitosamente"
          : "Producto agregado (se sincronizará al conectar)"
      );
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

      if (!isOnline) {
        await updateStockItemOffline(id, updates);
        return;
      }

      const { data, error } = await supabase
        .from("stock_items")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("No se pudo actualizar el producto");
      
      // Escribir inmediatamente en IndexedDB
      await localDB.stock_items.put(data);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success(
        isOnline
          ? "Producto actualizado exitosamente"
          : "Producto actualizado (se sincronizará al conectar)"
      );
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar producto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline) {
        await deleteStockItemOffline(id);
        return;
      }

      const { error } = await supabase.from("stock_items").delete().eq("id", id);
      if (error) throw error;
      
      // Escribir inmediatamente en IndexedDB
      await localDB.stock_items.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success(
        isOnline
          ? "Producto eliminado exitosamente"
          : "Producto eliminado (se sincronizará al conectar)"
      );
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