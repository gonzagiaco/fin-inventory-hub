import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductList, DynamicProduct, ColumnSchema } from "@/types/productList";

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

      const { data, error } = await supabase
        .from("dynamic_products")
        .select("*")
        .in("list_id", listIds);

      if (error) throw error;

      const grouped: Record<string, DynamicProduct[]> = {};
      (data || []).forEach((product) => {
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
      const { data: userData } = await supabase.auth.getUser();

      // Create the list
      const { data: listData, error: listError } = await supabase
        .from("product_lists")
        .insert([
          {
            user_id: userData.user?.id,
            supplier_id: supplierId,
            name,
            file_name: fileName,
            file_type: fileType,
            product_count: products.length,
            column_schema: JSON.parse(JSON.stringify(columnSchema)),
          },
        ])
        .select()
        .single();

      if (listError) throw listError;

      // Insert products
      const productsToInsert = products.map((product) => ({
        user_id: userData.user?.id,
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

  return {
    productLists,
    productsMap,
    isLoading,
    createList: createListMutation.mutate,
    deleteList: deleteListMutation.mutate,
  };
};
