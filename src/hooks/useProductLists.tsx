import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductList, DynamicProduct, ColumnSchema } from "@/types/productList";
import { fetchAllFromTable } from "@/utils/fetchAllProducts";
import { useOnlineStatus } from './useOnlineStatus';
import { getOfflineData, createProductListOffline, updateProductListOffline, deleteProductListOffline, localDB } from '@/lib/localDB';

// Helper function to extract name from product data when index is missing it
function extractNameFromData(
  data: Record<string, any>, 
  schema: ColumnSchema[], 
  mappingConfig?: any
): string {
  // 1. PRIORIDAD: Usar name_keys del mapping_config
  if (mappingConfig?.name_keys && Array.isArray(mappingConfig.name_keys)) {
    for (const key of mappingConfig.name_keys) {
      if (data[key] && String(data[key]).trim()) {
        return String(data[key]).trim();
      }
    }
  }
  
  // 2. FALLBACK: Buscar en schema
  for (const col of schema) {
    if (col.key !== 'code' && col.key !== 'price' && col.type === 'text' && data[col.key]) {
      return String(data[col.key]);
    }
  }
  
  // 3. FALLBACK FINAL: Campos comunes
  const commonNameFields = ['name', 'nombre', 'descripcion', 'description', 'producto', 'product'];
  for (const field of commonNameFields) {
    if (data[field]) {
      return String(data[field]);
    }
  }
  
  return 'Sin nombre';
}

export const useProductLists = (supplierId?: string) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const { data: productLists = [], isLoading } = useQuery({
    queryKey: ["product-lists", supplierId, isOnline ? 'online' : 'offline'],
    queryFn: async () => {
      // OFFLINE: Cargar desde IndexedDB
      if (isOnline === false) {
        const offlineLists = await getOfflineData('product_lists') as any[];
        return (offlineLists || [])
          .filter(list => !supplierId || list.supplier_id === supplierId)
          .map((list) => ({
          id: list.id,
          supplierId: list.supplier_id,
          name: list.name,
          fileName: list.file_name,
          fileType: list.file_type,
          createdAt: list.created_at,
          updatedAt: list.updated_at,
          productCount: list.product_count,
          columnSchema: Array.isArray(list.column_schema) ? list.column_schema : [],
          mapping_config: list.mapping_config || undefined,
        })) as ProductList[];
      }

      // ONLINE: Consultar Supabase
      let query = supabase.from("product_lists").select("*").order("created_at", { ascending: false });

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((list) => {
        const schema = list.column_schema;
        const columnSchema: ColumnSchema[] = Array.isArray(schema) ? (schema as unknown as ColumnSchema[]) : [];

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
          mapping_config: list.mapping_config || undefined,
        };
      }) as ProductList[];
    },
    enabled: !!supplierId,
  });

  const { data: productsMap = {} } = useQuery({
    queryKey: ["dynamic-products", supplierId, isOnline ? 'online' : 'offline'],
    queryFn: async () => {
      const listIds = productLists.map((list) => list.id);
      if (listIds.length === 0) return {};

      // OFFLINE: JOIN entre índice y productos completos
      if (isOnline === false) {
        const indexedProducts = await getOfflineData('dynamic_products_index') as any[];
        const fullProducts = await getOfflineData('dynamic_products') as any[];

        // Crear mapa de productos completos por ID para acceso rápido
        const fullProductsMap = new Map(fullProducts.map((p: any) => [p.id, p]));

        // Filtrar por listIds
        const filtered = indexedProducts.filter((p: any) => listIds.includes(p.list_id));

        const grouped: Record<string, DynamicProduct[]> = {};
        filtered.forEach((indexProduct: any) => {
          if (!grouped[indexProduct.list_id]) {
            grouped[indexProduct.list_id] = [];
          }

          // Find the list to get its column schema and mapping config for fallback
          const list = productLists.find(l => l.id === indexProduct.list_id);
          const columnSchema = list?.columnSchema || [];
          const mappingConfig = list?.mapping_config;

          // Obtener datos completos del producto original
          const fullProduct = fullProductsMap.get(indexProduct.product_id);

          grouped[indexProduct.list_id].push({
            id: indexProduct.product_id, // ID del producto original
            listId: indexProduct.list_id,
            code: indexProduct.code, // Del índice (ya normalizado)
            name: indexProduct.name || extractNameFromData(fullProduct?.data || {}, columnSchema, mappingConfig), // Del índice con fallback usando mappingConfig
            price: indexProduct.price !== null ? Number(indexProduct.price) : undefined, // Del índice (ya calculado)
            quantity: indexProduct.quantity, // Del índice
            data: fullProduct?.data as Record<string, any> || {}, // Del producto completo para columnas dinámicas
          });
        });
        
        return grouped;
      }

      // ONLINE: Use optimized fetch to get ALL products (no 1000 limit)
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
      // OFFLINE: Crear en IndexedDB
      if (isOnline === false) {
        return await createProductListOffline({
          supplierId,
          name,
          fileName,
          fileType,
          columnSchema,
          products,
        });
      }

      // ONLINE: Crear en Supabase
      const { data: userData, error: authError } = await supabase.auth.getUser();

      if (authError || !userData.user) {
        throw new Error("Usuario no autenticado");
      }

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

      const productsToInsert = products.map((product) => ({
        user_id: userData.user.id,
        list_id: listData.id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        data: product.data,
      }));

      const { error: productsError } = await supabase.from("dynamic_products").insert(productsToInsert);

      if (productsError) throw productsError;

      return listData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-lists"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-products"] });
      toast.success(
        isOnline
          ? "Lista de productos importada exitosamente"
          : "Lista creada (se sincronizará al conectar)"
      );
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al importar lista de productos");
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      // OFFLINE: Eliminar de IndexedDB
      if (isOnline === false) {
        await deleteProductListOffline(listId);
        return;
      }

      // ONLINE: Eliminar de Supabase
      const { error } = await supabase.from("product_lists").delete().eq("id", listId);
      if (error) throw error;

      // ✅ Limpiar IndexedDB inmediatamente (solución híbrida)
      await localDB.product_lists.delete(listId);
      await localDB.dynamic_products.where('list_id').equals(listId).delete();
      await localDB.dynamic_products_index.where('list_id').equals(listId).delete();
    },
    onSuccess: (_, listId) => {
      // Resetear queries específicas de esta lista (fuerza limpieza completa)
      queryClient.resetQueries({
        queryKey: ["list-products", listId],
        exact: false,
      });
      
      // Invalidar queries generales con refetchType: 'all' para incluir queries inactivas
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists"],
        refetchType: 'all' 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ["dynamic-products"],
        refetchType: 'all' 
      });
      
      // Invalidar índices globales
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists-index"],
        refetchType: 'all' 
      });
      
      toast.success(
        isOnline
          ? "Lista eliminada exitosamente"
          : "Lista eliminada (se sincronizará al conectar)"
      );
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
    onSuccess: (_, variables) => {
      const { listId } = variables;
      
      // Resetear queries específicas de esta lista
      queryClient.resetQueries({
        queryKey: ["list-products", listId],
        exact: false,
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists"],
        refetchType: 'all' 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ["all-product-lists"],
        refetchType: 'all' 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists-index"],
        refetchType: 'all' 
      });
      
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
      // OFFLINE: Actualizar en IndexedDB
      if (isOnline === false) {
        await updateProductListOffline(listId, {
          fileName,
          columnSchema,
          products,
        });
        return;
      }

      // ONLINE: Actualizar en Supabase
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
      const { error: deleteError } = await supabase.from("dynamic_products").delete().eq("list_id", listId);

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

      const { error: insertError } = await supabase.from("dynamic_products").insert(productsToInsert);

      if (insertError) throw insertError;

      // ✅ Limpiar productos viejos de IndexedDB
      await localDB.dynamic_products.where('list_id').equals(listId).delete();
      await localDB.dynamic_products_index.where('list_id').equals(listId).delete();

      // ✅ Sincronizar productos nuevos desde Supabase a IndexedDB
      const { data: indexData } = await supabase
        .from("dynamic_products_index")
        .select("*")
        .eq("list_id", listId);

      if (indexData) {
        await localDB.dynamic_products_index.bulkAdd(indexData);
      }
    },
    onSuccess: (_, variables) => {
      const { listId } = variables;
      
      // Resetear queries específicas de esta lista
      queryClient.resetQueries({
        queryKey: ["list-products", listId],
        exact: false,
      });
      
      // Invalidar queries generales con refetchType: 'all'
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists"],
        refetchType: 'all' 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ["dynamic-products"],
        refetchType: 'all' 
      });
      
      // Invalidar índices globales
      queryClient.invalidateQueries({ 
        queryKey: ["product-lists-index"],
        refetchType: 'all' 
      });
      
      toast.success(
        isOnline
          ? "Lista actualizada exitosamente"
          : "Lista actualizada (se sincronizará al conectar)"
      );
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar lista");
    },
  });

  // @deprecated - Helper function to find similar list
  // No longer used - user now selects from all available lists
  const findSimilarList = (fileName: string, columnSchema: ColumnSchema[]) => {
    // 1. Exact match by file name
    const exactMatch = productLists.find((list) => list.fileName === fileName);
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
    createList: createListMutation.mutateAsync,
    deleteList: deleteListMutation.mutate,
    updateColumnSchema: updateColumnSchemaMutation.mutateAsync,
    updateList: updateListMutation.mutate,
    findSimilarList,
  };
};
