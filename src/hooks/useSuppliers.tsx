import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/types";
import { toast } from "sonner";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  createSupplierOffline,
  updateSupplierOffline,
  deleteSupplierOffline,
  getOfflineData,
  upsertSupplierLocalRecord,
  deleteSupplierLocalRecord,
  deleteProductListLocalRecord,
} from "@/lib/localDB";

export function useSuppliers() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const mapSupplierToLocalRecord = (supplierData: any) => {
    if (!supplierData) return null;
    return {
      id: supplierData.id,
      name: supplierData.name,
      logo_url: supplierData.logo_url ?? supplierData.logo ?? null,
      user_id: supplierData.user_id,
      created_at: supplierData.created_at,
      updated_at: supplierData.updated_at,
    };
  };

  const removeSupplierLocalLists = async (supplierId: string) => {
    try {
      const offlineLists = (await getOfflineData("product_lists")) as Array<{
        id: string;
        supplier_id?: string;
      }>;

      const supplierLists = offlineLists.filter((list) => list.supplier_id === supplierId);
      if (supplierLists.length === 0) {
        return;
      }

      for (const list of supplierLists) {
        await deleteProductListLocalRecord(list.id);
      }
    } catch (error) {
      console.error("Error al eliminar listas locales del proveedor:", error);
    }
  };

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", isOnline],
    queryFn: async () => {
      if (isOnline === false) {
        const offlineData = (await getOfflineData("suppliers")) as any[];
        return (offlineData || []).map((s) => ({
          id: s.id,
          name: s.name,
          logo: s.logo_url,
        })) as Supplier[];
      }

      const { data, error } = await supabase.from("suppliers").select("*").order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        logo: s.logo_url,
      })) as Supplier[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (supplier: Omit<Supplier, "id">) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No autenticado");

      if (isOnline === false) {
        const id = await createSupplierOffline({
          name: supplier.name,
          logo_url: supplier.logo,
          user_id: user.user.id,
        });
        return { id, ...supplier };
      }

      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: supplier.name,
          logo_url: supplier.logo,
          user_id: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (createdSupplier) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      if (isOnline && createdSupplier) {
        try {
          const record = mapSupplierToLocalRecord(createdSupplier);
          if (record) {
            await upsertSupplierLocalRecord(record);
          }
        } catch (error) {
          console.error("Error al sincronizar proveedor localmente después de crear:", error);
        }
      }
      toast.success(isOnline ? "Proveedor creado exitosamente" : "Proveedor creado (se sincronizará al conectar)");
    },
    onError: (error: any) => {
      toast.error(`Error al crear proveedor: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Supplier) => {
      if (isOnline === false) {
        await updateSupplierOffline(id, {
          name: updates.name,
          logo_url: updates.logo,
        });
        return { id, ...updates };
      }

      const { data, error } = await supabase
        .from("suppliers")
        .update({
          name: updates.name,
          logo_url: updates.logo,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (updatedSupplier) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      if (isOnline && updatedSupplier) {
        try {
          const record = mapSupplierToLocalRecord(updatedSupplier);
          if (record) {
            await upsertSupplierLocalRecord(record);
          }
        } catch (error) {
          console.error("Error al sincronizar proveedor localmente después de actualizar:", error);
        }
      }
      toast.success(
        isOnline ? "Proveedor actualizado exitosamente" : "Proveedor actualizado (se sincronizará al conectar)",
      );
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar proveedor: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isOnline === false) {
        await deleteSupplierOffline(id);
        return;
      }

      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      if (id) {
        try {
          await removeSupplierLocalLists(id);
          if (isOnline) {
            await deleteSupplierLocalRecord(id);
          }
        } catch (error) {
          console.error("Error al sincronizar datos locales después de eliminar proveedor:", error);
        }
      }
      toast.success(
        isOnline ? "Proveedor eliminado exitosamente" : "Proveedor eliminado (se sincronizará al conectar)",
      );
    },
    onError: (error: any) => {
      toast.error(`Error al eliminar proveedor: ${error.message}`);
    },
  });

  return {
    suppliers,
    isLoading,
    createSupplier: createMutation.mutateAsync,
    updateSupplier: updateMutation.mutateAsync,
    deleteSupplier: deleteMutation.mutateAsync,
  };
}
