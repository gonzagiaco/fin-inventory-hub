import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Supplier } from "@/types";

export const useSuppliers = () => {
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Convert snake_case to camelCase
      return (data || []).map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        logo: supplier.logo_url,
      })) as Supplier[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (supplier: Omit<Supplier, "id">) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("suppliers")
        .insert([{
          user_id: userData.user?.id,
          name: supplier.name,
          logo_url: supplier.logo,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Proveedor agregado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al agregar proveedor");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...supplier }: Partial<Supplier> & { id: string }) => {
      const updates: any = {};
      
      if (supplier.name !== undefined) updates.name = supplier.name;
      if (supplier.logo !== undefined) updates.logo_url = supplier.logo;

      const { data, error } = await supabase
        .from("suppliers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Proveedor actualizado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar proveedor");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Proveedor eliminado exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar proveedor");
    },
  });

  return {
    suppliers,
    isLoading,
    createSupplier: createMutation.mutate,
    updateSupplier: updateMutation.mutate,
    deleteSupplier: deleteMutation.mutate,
  };
};