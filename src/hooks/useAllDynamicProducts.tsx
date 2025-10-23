import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/types";
import { ProductList, ColumnSchema, DynamicProduct } from "@/types/productList";

export interface EnrichedProduct {
  id: string;
  listId: string;
  code?: string;
  name?: string;
  price?: number;
  quantity?: number;
  data: Record<string, any>;
  supplierName: string;
  supplierLogo?: string;
  supplierId: string;
}

export const useAllDynamicProducts = () => {
  // Fetch all suppliers
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        logo: supplier.logo_url,
      })) as Supplier[];
    },
  });

  // Fetch all product lists
  const { data: productLists = [], isLoading: isLoadingLists } = useQuery({
    queryKey: ["all-product-lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_lists")
        .select("*")
        .order("created_at", { ascending: false });

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
  });

  // Fetch all dynamic products
  const { data: allProducts = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["all-dynamic-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_products")
        .select("*");

      if (error) throw error;

      // Create a map of listId to supplierId
      const listToSupplierMap = new Map(
        productLists.map((list) => [list.id, list.supplierId])
      );

      // Create a map of supplierId to supplier info
      const supplierMap = new Map(
        suppliers.map((supplier) => [supplier.id, supplier])
      );

      return (data || []).map((product): EnrichedProduct => {
        const supplierId = listToSupplierMap.get(product.list_id) || "";
        const supplier = supplierMap.get(supplierId);

        return {
          id: product.id,
          listId: product.list_id,
          code: product.code,
          name: product.name,
          price: product.price ? Number(product.price) : undefined,
          quantity: product.quantity,
          data: product.data as Record<string, any>,
          supplierName: supplier?.name || "Unknown",
          supplierLogo: supplier?.logo,
          supplierId: supplierId,
        };
      });
    },
    enabled: productLists.length > 0 && suppliers.length > 0,
  });

  return {
    allProducts,
    suppliers,
    productLists,
    isLoading: isLoadingSuppliers || isLoadingLists || isLoadingProducts,
  };
};
