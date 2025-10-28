import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/types";
import { ProductList, ColumnSchema, DynamicProduct } from "@/types/productList";
import { fetchAllFromTable } from "@/utils/fetchAllProducts";

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

export interface ProductListDetails {
  listId: string;
  listName: string;
  supplierId: string;
  supplierName: string;
  supplierLogo: string | null;
  columnSchema: ColumnSchema[];
  productCount: number;
}

export const useAllDynamicProducts = () => {
  // Fetch all suppliers
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });

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
        };
      }) as ProductList[];
    },
  });

  // Fetch all dynamic products
  const { data: dynamicProducts = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["all-dynamic-products"],
    queryFn: async () => {
      // Use optimized fetch to get ALL products (no 1000 limit)
      const allProducts = await fetchAllFromTable<any>("dynamic_products");

      const products = allProducts.map((item) => ({
        id: item.id,
        listId: item.list_id,
        code: item.code || undefined,
        name: item.name || undefined,
        price: item.price ? Number(item.price) : undefined,
        quantity: item.quantity || undefined,
        data: (item.data as Record<string, any>) || {},
      })) as DynamicProduct[];

      // Debug logs
      console.log("📊 Total dynamic products fetched:", products.length);
      console.log(
        "📋 Products by list:",
        Array.from(
          products.reduce((acc, p) => {
            acc.set(p.listId, (acc.get(p.listId) || 0) + 1);
            return acc;
          }, new Map<string, number>()),
        ).map(([listId, count]) => ({ listId, count })),
      );

      return products;
    },
    enabled: !isLoadingSuppliers && !isLoadingLists && suppliers.length > 0 && productLists.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - avoid unnecessary re-fetches
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
  });

  // Create productsByList and listDetails maps
  const productsByList = new Map<string, EnrichedProduct[]>();
  const listDetails = new Map<string, ProductListDetails>();

  // Group products by list and enrich with supplier info
  productLists.forEach((list) => {
    const supplier = suppliers.find((s) => s.id === list.supplierId);

    // Store list details
    listDetails.set(list.id, {
      listId: list.id,
      listName: list.name,
      supplierId: list.supplierId,
      supplierName: supplier?.name || "Unknown",
      supplierLogo: supplier?.logo || null,
      columnSchema: list.columnSchema,
      productCount: list.productCount,
    });

    // Get products for this list
    const listProducts = dynamicProducts
      .filter((product) => product.listId === list.id)
      .map((product) => ({
        ...product,
        supplierName: supplier?.name || "Unknown",
        supplierLogo: supplier?.logo,
        supplierId: list.supplierId,
      }));

    productsByList.set(list.id, listProducts);
  });

  // Also create flat array for backwards compatibility
  const allProducts: EnrichedProduct[] = dynamicProducts.map((product) => {
    const list = productLists.find((list) => list.id === product.listId);
    const supplier = list ? suppliers.find((s) => s.id === list.supplierId) : undefined;

    return {
      ...product,
      supplierName: supplier?.name || "Unknown",
      supplierLogo: supplier?.logo,
      supplierId: list?.supplierId || "",
    };
  });

  return {
    allProducts,
    productsByList,
    listDetails,
    suppliers,
    productLists,
    isLoading: isLoadingSuppliers || isLoadingLists || isLoadingProducts,
  };
};
