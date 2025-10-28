import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/types";
import { ProductList, ColumnSchema } from "@/types/productList";

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

type LoadedCounts = Map<string, number>;

const PAGE_SIZE_TABLE = 200; // tamaño de página para backend
const ORDER_COLUMN = "id";

export const useAllDynamicProducts = () => {
  // 1) Proveedores
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s) => ({ id: s.id, name: s.name, logo: s.logo_url })) as Supplier[];
    },
    staleTime: 5 * 60_000,
  });

  // 2) Listas
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
    staleTime: 5 * 60_000,
  });

  // 3) Detalles de lista (memo)
  const listDetails = useMemo(() => {
    const m = new Map<string, ProductListDetails>();
    productLists.forEach((list) => {
      const supplier = suppliers.find((s) => s.id === list.supplierId);
      m.set(list.id, {
        listId: list.id,
        listName: list.name,
        supplierId: list.supplierId,
        supplierName: supplier?.name || "Unknown",
        supplierLogo: supplier?.logo || null,
        columnSchema: list.columnSchema,
        productCount: list.productCount,
      });
    });
    return m;
  }, [productLists, suppliers]);

  // 4) Estado incremental por lista
  const [productsByList, setProductsByList] = useState<Map<string, EnrichedProduct[]>>(new Map());
  const [loadedCountsByList, setLoadedCountsByList] = useState<LoadedCounts>(new Map());
  const [bootstrapped, setBootstrapped] = useState(false); // al menos 1 página cargada
  const isPriming = isLoadingSuppliers || isLoadingLists;

  useEffect(() => {
    if (isPriming || suppliers.length === 0 || productLists.length === 0) return;
    let cancelled = false;

    const loadAllListsSequentially = async () => {
      for (const list of productLists) {
        const supplier = suppliers.find((s) => s.id === list.supplierId);
        const supplierName = supplier?.name || "Unknown";
        const supplierLogo = supplier?.logo;

        const total = Number(list.productCount ?? 0);
        let offset = 0;

        while (!cancelled && (total === 0 ? offset === 0 : offset < total)) {
          const { data, error } = await supabase
            .from("dynamic_products")
            .select("*")
            .eq("list_id", list.id)
            .order(ORDER_COLUMN, { ascending: true })
            .range(offset, offset + PAGE_SIZE_TABLE - 1);

          if (error) {
            console.error("Error fetching page:", error);
            break;
          }

          const page = (data || []).map((item) => ({
            id: item.id,
            listId: item.list_id,
            code: item.code || undefined,
            name: item.name || undefined,
            price: item.price ? Number(item.price) : undefined,
            quantity: item.quantity || undefined,
            data: (item.data as Record<string, any>) || {},
            supplierName,
            supplierLogo,
            supplierId: list.supplierId,
          })) as EnrichedProduct[];

          // aplicar chunk al estado
          if (page.length > 0) {
            setProductsByList((prev) => {
              const next = new Map(prev);
              const current = next.get(list.id) || [];
              next.set(list.id, current.concat(page));
              return next;
            });
            setLoadedCountsByList((prev) => {
              const next = new Map(prev);
              next.set(list.id, (next.get(list.id) || 0) + page.length);
              return next;
            });
            if (!bootstrapped) setBootstrapped(true);
          }

          // si no conocemos total, avanzar igual hasta que la página venga vacía
          if (page.length < PAGE_SIZE_TABLE) break;
          offset += PAGE_SIZE_TABLE;
        }
      }
    };

    loadAllListsSequentially();
    return () => {
      cancelled = true;
    };
  }, [isPriming, suppliers, productLists, bootstrapped]);

  // 5) Derivados
  const allProducts: EnrichedProduct[] = useMemo(() => {
    const out: EnrichedProduct[] = [];
    productsByList.forEach((arr) => out.push(...arr));
    return out;
  }, [productsByList]);

  // isLoading: mostrar spinner solo hasta la primera página
  const isLoading = isPriming || !bootstrapped;

  return {
    allProducts,
    productsByList,
    listDetails,
    suppliers,
    productLists,
    loadedCountsByList,
    isLoading,
  };
};
