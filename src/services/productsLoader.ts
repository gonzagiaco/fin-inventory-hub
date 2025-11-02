// src/services/productsLoader.ts
import { supabase } from "@/integrations/supabase/client";
import type { Supplier } from "@/types";
import type { ColumnSchema } from "@/types/productList";
import type { EnrichedProduct, ProductListDetails } from "@/hooks/useAllDynamicProducts";

/**
 * Carga TODO desde Supabase y devuelve las mismas estructuras que usa la app.
 * Sin React Query. Sin estados de React. Útil para el store global (ensureLoaded).
 */
export async function fetchAllListsAndProducts(): Promise<{
  productsByList: Map<string, EnrichedProduct[]>;
  listDetails: Map<string, ProductListDetails>;
  suppliers: Array<{ id: string; name: string; logo?: string | null }>;
}> {
  // 1) Suppliers
  const { data: rawSuppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });
  if (supErr) throw supErr;

  const suppliers: Supplier[] = (rawSuppliers || []).map((s) => ({
    id: s.id,
    name: s.name,
    logo: s.logo_url,
  })) as Supplier[];

  // 2) Product lists
  const { data: rawLists, error: listErr } = await supabase
    .from("product_lists")
    .select("*")
    .order("created_at", { ascending: false });
  if (listErr) throw listErr;

  const productLists = (rawLists || []).map((list) => {
    const schema = list.column_schema;
const columnSchema: ColumnSchema[] = Array.isArray(schema)
          ? (schema as unknown as ColumnSchema[]) : [];
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
  });

  // 3) Dynamic products
  const { data: rawProducts, error: prodErr } = await supabase
    .from("dynamic_products")
    .select("*");
  if (prodErr) throw prodErr;

  const dynamicProducts = (rawProducts || []).map((item) => ({
    id: item.id,
    listId: item.list_id,
    code: item.code || undefined,
    name: item.name || undefined,
    price: item.price ? Number(item.price) : undefined,
    quantity: item.quantity || undefined,
    data: (item.data as Record<string, any>) || {},
  }));

  // 4) Maps: listDetails y productsByList
  const suppliersById = new Map(suppliers.map((s) => [s.id, s]));
  const listDetails = new Map<string, ProductListDetails>();

  // Pre-group para O(n)
  const groupedByList = new Map<string, typeof dynamicProducts>();
  for (const p of dynamicProducts) {
    const arr = groupedByList.get(p.listId) || [];
    arr.push(p);
    groupedByList.set(p.listId, arr);
  }

  const productsByList = new Map<string, EnrichedProduct[]>();

  for (const list of productLists) {
    const sup = suppliersById.get(list.supplierId);
    listDetails.set(list.id, {
      listId: list.id,
      listName: list.name,
      supplierId: list.supplierId,
      supplierName: sup?.name || "Unknown",
      supplierLogo: sup?.logo || null,
      columnSchema: list.columnSchema,
      productCount: list.productCount,
    });

    const items = groupedByList.get(list.id) || [];
    const enriched: EnrichedProduct[] = items.map((product) => ({
      ...product,
      supplierName: sup?.name || "Unknown",
      supplierLogo: sup?.logo || undefined,
      supplierId: list.supplierId,
    }));
    productsByList.set(list.id, enriched);
  }

  return {
    productsByList,
    listDetails,
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, logo: s.logo ?? null })),
  };
}
