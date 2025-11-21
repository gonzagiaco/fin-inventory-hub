import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/types";
import { toast } from "sonner";
import { useOnlineStatus } from "./useOnlineStatus";
import { createSupplierOffline, updateSupplierOffline, deleteSupplierOffline, getOfflineData } from "@/lib/localDB";

export function useSuppliers() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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
        return;
      }

      const { error } = await supabase
        .from("suppliers")
        .update({
          name: updates.name,
          logo_url: updates.logo,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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
