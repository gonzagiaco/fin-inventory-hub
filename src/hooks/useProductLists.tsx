import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductList, DynamicProduct, ColumnSchema } from "@/types/productList";
import { fetchAllFromTable } from "@/utils/fetchAllProducts";

export const useProductLists = (supplierId?: string) => {
  const queryClient = useQueryClient();

  const { data: productLists = [], isLoading } = useQuery({
    queryKey: ["product-lists", supplierId],
    queryFn: async () => {
      let query = supabase
        .from("product_lists")
        .select("*")
        .order("created_at", { ascending: false });

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((list) => {
        const schema = list.column_schema;
        const columnSchema: ColumnSchema[] = Array.isArray(schema)
          ? (schema as unknown as ColumnSchema[])
          : [];
        
        return {
          id: list.id,
          supplierId: list.supplier_id,
          name: list.name,
          fileName: list.file_name,
          fileType: list.file_type,
          createdAt: list.created_at,
          updatedAt: list.updated_at,
          productCount: list.product_count,
          columnSchema,
        };
      }) as ProductList[];
    },
    enabled: !!supplierId,
  });

  const { data: productsMap = {} } = useQuery({
    queryKey: ["dynamic-products", supplierId],
    queryFn: async () => {
      const listIds = productLists.map((list) => list.id);
      if (listIds.length === 0) return {};

      // Use optimized fetch to get ALL products (no 1000 limit)
      const allProducts = await fetchAllFromTable<any>("dynamic_products", listIds);

      const grouped: Record<string, DynamicProduct[]> = {};
      allProducts.forEach((product) => {
        const listId = product.list_id;
        if (!grouped[listId]) {
          grouped[listId] = [];
        }
        grouped[listId].push({
          id: product.id,
          listId: product.list_id,
          code: product.code,
          name: product.name,
          price: product.price ? Number(product.price) : undefined,
          quantity: product.quantity,
          data: product.data as Record<string, any>,
        });
      });

      return grouped;
    },
    enabled: productLists.length > 0,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 8 * 60 * 1000, // 8 minutes in cache
  });

  const createListMutation = useMutation({
    mutationFn: async ({
      supplierId,
      name,
      fileName,
      fileType,
      columnSchema,
      products,
    }: {
      supplierId: string;
      name: string;
      fileName: string;
      fileType: string;
      columnSchema: ColumnSchema[];
      products: DynamicProduct[];
    }) => {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      
      if (authError || !userData.user) {
        throw new Error("Usuario no autenticado");
      }

      // Create the list
      const { data: listData, error: listError } = await supabase
        .from("product_lists")
        .insert([
          {
            user_id: userData.user.id,
            supplier_id: supplierId,
            name,
            file_name: fileName,
            file_type: fileType,
            product_count: products.length,
            column_schema: JSON.parse(JSON.stringify(columnSchema)),
          },
        ])
        .select()
        .maybeSingle();

      if (listError) throw listError;
      if (!listData) throw new Error("No se pudo crear la lista de productos");

      // Insert products
      const productsToInsert = products.map((product) => ({
        user_id: userData.user.id,
        list_id: listData.id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        data: product.data,
      }));

      const { error: productsError } = await supabase
        .from("dynamic_products")
        .insert(productsToInsert);

      if (productsError) throw productsError;

      return listData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-products"] });
      toast.success("Lista de productos importada exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al importar lista de productos");
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from("product_lists")
        .delete()
        .eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-products"] });
      toast.success("Lista eliminada exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar lista");
    },
  });

  const updateColumnSchemaMutation = useMutation({
    mutationFn: async ({ listId, columnSchema }: { listId: string; columnSchema: ColumnSchema[] }) => {
      const { error } = await supabase
        .from("product_lists")
        .update({ column_schema: JSON.parse(JSON.stringify(columnSchema)) })
        .eq("id", listId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-lists"] });
      queryClient.invalidateQueries({ queryKey: ["all-product-lists"] });
      toast.success("Esquema de columnas actualizado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar columnas");
    },
  });

  const updateListMutation = useMutation({
    mutationFn: async ({
      listId,
      fileName,
      columnSchema,
      products,
    }: {
      listId: string;
      fileName: string;
      columnSchema: ColumnSchema[];
      products: DynamicProduct[];
    }) => {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      
      if (authError || !userData.user) {
        throw new Error("Usuario no autenticado");
      }

      // 1. Update list metadata
      const { error: updateError } = await supabase
        .from("product_lists")
        .update({
          file_name: fileName,
          updated_at: new Date().toISOString(),
          product_count: products.length,
          column_schema: JSON.parse(JSON.stringify(columnSchema)),
        })
        .eq("id", listId);

      if (updateError) throw updateError;

      // 2. Delete old products
      const { error: deleteError } = await supabase
        .from("dynamic_products")
        .delete()
        .eq("list_id", listId);

      if (deleteError) throw deleteError;

      // 3. Insert new products
      const productsToInsert = products.map((product) => ({
        user_id: userData.user.id,
        list_id: listId,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        data: product.data,
      }));

      const { error: insertError } = await supabase
        .from("dynamic_products")
        .insert(productsToInsert);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-products"] });
      toast.success("Lista actualizada exitosamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar lista");
    },
  });

  // @deprecated - Helper function to find similar list
  // No longer used - user now selects from all available lists
  const findSimilarList = (fileName: string, columnSchema: ColumnSchema[]) => {
    // 1. Exact match by file name
    const exactMatch = productLists.find(
      (list) => list.fileName === fileName
    );
    if (exactMatch) return exactMatch;

    // 2. Match by column similarity (>75%)
    const newKeys = columnSchema.map((c) => c.key).sort();
    
    for (const list of productLists) {
      const existingKeys = list.columnSchema.map((c) => c.key).sort();
      const commonKeys = newKeys.filter((k) => existingKeys.includes(k));
      const similarity = (commonKeys.length / Math.max(newKeys.length, existingKeys.length)) * 100;
      
      if (similarity > 75) {
        return list;
      }
    }

    return null;
  };

  return {
    productLists,
    productsMap,
    isLoading,
    createList: createListMutation.mutate,
    deleteList: deleteListMutation.mutate,
    updateColumnSchema: updateColumnSchemaMutation.mutateAsync,
    updateList: updateListMutation.mutate,
    findSimilarList,
  };
};
