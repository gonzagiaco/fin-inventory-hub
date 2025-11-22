import Dexie, { Table } from "dexie";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchAllFromTable } from "@/utils/fetchAllProducts";

// ==================== INTERFACES ====================

export interface PendingOperation {
  id?: number;
  table_name: string;
  operation_type: "INSERT" | "UPDATE" | "DELETE";
  record_id: string;
  data: any;
  timestamp: number;
  retry_count: number;
  error?: string;
}

interface SupplierDB {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

interface ProductListDB {
  id: string;
  user_id: string;
  supplier_id: string;
  name: string;
  file_name: string;
  file_type: string;
  product_count: number;
  column_schema: any;
  mapping_config?: any;
  created_at: string;
  updated_at: string;
}

interface DynamicProductIndexDB {
  id: string;
  user_id: string;
  list_id: string;
  product_id: string;
  code?: string;
  name?: string;
  price?: number;
  quantity?: number;
  created_at: string;
  updated_at: string;
}

interface DynamicProductDB {
  id: string;
  user_id: string;
  list_id: string;
  code?: string;
  name?: string;
  price?: number;
  quantity?: number;
  data: any;
  created_at: string;
  updated_at: string;
}

interface DeliveryNoteDB {
  id: string;
  user_id: string;
  customer_name: string;
  customer_address?: string;
  customer_phone?: string;
  issue_date: string;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  status: string;
  extra_fields?: any;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface DeliveryNoteItemDB {
  id: string;
  delivery_note_id: string;
  product_id?: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

interface RequestItemDB {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
}

interface StockItemDB {
  id: string;
  user_id: string;
  code: string;
  name: string;
  quantity: number;
  category?: string;
  cost_price?: number;
  supplier_id?: string;
  special_discount: boolean;
  min_stock_limit: number;
  extras?: any;
  created_at: string;
  updated_at: string;
}

interface AuthTokenDB {
  userId: string;
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  updatedAt: string;
}

interface SettingsDB {
  key: string;
  value: any;
  updated_at: string;
  created_at: string;
}

interface IdMappingDB {
  temp_id: string;
  real_id: string;
  table_name: string;
  created_at: string;
}

interface StockCompensationDB {
  id?: number;
  operation_id: number;
  product_id: string;
  quantity_delta: number;
  timestamp: number;
}

// ==================== DEXIE DATABASE ====================

class LocalDatabase extends Dexie {
  suppliers!: Table<SupplierDB, string>;
  product_lists!: Table<ProductListDB, string>;
  dynamic_products_index!: Table<DynamicProductIndexDB, string>;
  dynamic_products!: Table<DynamicProductDB, string>;
  delivery_notes!: Table<DeliveryNoteDB, string>;
  delivery_note_items!: Table<DeliveryNoteItemDB, string>;
  request_items!: Table<RequestItemDB, string>;
  stock_items!: Table<StockItemDB, string>;
  pending_operations!: Table<PendingOperation, number>;
  tokens!: Table<AuthTokenDB, string>;
  settings!: Table<SettingsDB, string>;
  id_mappings!: Table<IdMappingDB, string>;
  stock_compensations!: Table<StockCompensationDB, number>;

  constructor() {
    super("ProveedoresLocalDB");

    this.version(1).stores({
      suppliers: "id, user_id, name",
      product_lists: "id, user_id, supplier_id, name",
      dynamic_products_index: "id, user_id, list_id, product_id, code, name",
      dynamic_products: "id, user_id, list_id, code, name",
      delivery_notes: "id, user_id, customer_name, status, issue_date",
      delivery_note_items: "id, delivery_note_id, product_id",
      settings: "key, updated_at",
      request_items: "id, user_id, product_id",
      stock_items: "id, user_id, code, name, category, supplier_id",
      pending_operations: "++id, table_name, timestamp, record_id",
      tokens: "userId, updatedAt",
    });

    // Versión 5: Agregar tablas para mapeo de IDs y compensación de stock
    this.version(5).stores({
      suppliers: "id, user_id, name",
      product_lists: "id, user_id, supplier_id, name",
      dynamic_products_index: "id, user_id, list_id, product_id, code, name",
      dynamic_products: "id, user_id, list_id, code, name",
      delivery_notes: "id, user_id, customer_name, status, issue_date",
      delivery_note_items: "id, delivery_note_id, product_id",
      settings: "key, updated_at",
      request_items: "id, user_id, product_id",
      stock_items: "id, user_id, code, name, category, supplier_id",
      pending_operations: "++id, table_name, timestamp, record_id",
      tokens: "userId, updatedAt",
      id_mappings: "temp_id, real_id, table_name",
      stock_compensations: "++id, operation_id, product_id",
    });
  }
}

export const localDB = new LocalDatabase();

// ==================== CONSTANTES ====================

const SYNC_ORDER = [
  "suppliers",
  "product_lists",
  "dynamic_products",
  "dynamic_products_index",
  "stock_items",
  "delivery_notes",
  "delivery_note_items",
  "request_items",
];

// ==================== UTILIDADES ====================

export function isOnline(): boolean {
  return navigator.onLine;
}

function generateTempId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isTempId(id: string): boolean {
  return id.startsWith("offline-");
}

// ==================== INICIALIZACIÓN ====================

export async function initDB(): Promise<void> {
  try {
    await localDB.open();
    console.log("✅ IndexedDB inicializada correctamente");
  } catch (error) {
    console.error("❌ Error al inicializar IndexedDB:", error);
    throw error;
  }
}

// ==================== SINCRONIZACIÓN DESDE SUPABASE ====================

export async function syncFromSupabase(): Promise<void> {
  if (!isOnline()) {
    console.warn("⚠️ No hay conexión. No se puede sincronizar desde Supabase");
    return;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Usuario no autenticado");
    }

    console.log("🔄 Iniciando sincronización desde Supabase...");

    // Sincronizar suppliers
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("user_id", user.id);
    if (suppliersError) throw suppliersError;

    if (suppliers !== undefined) {
      await localDB.suppliers.clear(); // limpia proveedores viejos
      if (suppliers.length > 0) {
        await localDB.suppliers.bulkAdd(suppliers as SupplierDB[]);
        console.log(`✅ ${suppliers.length} proveedores sincronizados`);
      } else {
        console.log("✅ 0 proveedores sincronizados (tabla vacía)");
      }
    }

    // Sincronizar product_lists
    const { data: productLists, error: listsError } = await supabase
      .from("product_lists")
      .select("*")
      .eq("user_id", user.id);
    if (listsError) throw listsError;

    if (productLists !== undefined) {
      await localDB.product_lists.clear(); // limpia listas viejas
      if (productLists.length > 0) {
        await localDB.product_lists.bulkAdd(productLists as ProductListDB[]);
        console.log(`✅ ${productLists.length} listas de productos sincronizadas`);
      } else {
        console.log("✅ 0 listas de productos sincronizadas (tabla vacía)");
      }
    }

    // Sincronizar dynamic_products_index (CON PAGINACIÓN)
    let productsIndex: any[] = [];
    try {
      productsIndex = await fetchAllFromTable("dynamic_products_index", undefined, user.id);

      await localDB.dynamic_products_index.clear(); // limpia index viejo
      if (productsIndex.length > 0) {
        await localDB.dynamic_products_index.bulkAdd(productsIndex as DynamicProductIndexDB[]);
        console.log(`✅ ${productsIndex.length} productos (index) sincronizados`);
      } else {
        console.log("✅ 0 productos (index) sincronizados (tabla vacía)");
      }
    } catch (indexError) {
      console.error("Error sincronizando products_index:", indexError);
      throw indexError;
    }

    // Sincronizar dynamic_products (CON PAGINACIÓN)
    let products: any[] = [];
    try {
      products = await fetchAllFromTable("dynamic_products", undefined, user.id);

      await localDB.dynamic_products.clear(); // limpia productos viejos
      if (products.length > 0) {
        await localDB.dynamic_products.bulkAdd(products as DynamicProductDB[]);
        console.log(`✅ ${products.length} productos completos sincronizados`);
      } else {
        console.log("✅ 0 productos completos sincronizados (tabla vacía)");
      }
    } catch (productsError) {
      console.error("Error sincronizando dynamic_products:", productsError);
      throw productsError;
    }

    // Sincronizar delivery_notes
    const { data: deliveryNotes, error: notesError } = await supabase
      .from("delivery_notes")
      .select("*")
      .eq("user_id", user.id);
    if (notesError) throw notesError;

    if (deliveryNotes !== undefined) {
      await localDB.delivery_notes.clear(); // limpia remitos viejos
      if (deliveryNotes.length > 0) {
        await localDB.delivery_notes.bulkAdd(deliveryNotes as DeliveryNoteDB[]);
        console.log(`✅ ${deliveryNotes.length} remitos sincronizados`);
      } else {
        console.log("✅ 0 remitos sincronizados (tabla vacía)");
      }
    }

    // Sincronizar delivery_note_items
    const { data: noteItems, error: itemsError } = await supabase.from("delivery_note_items").select("*");
    if (itemsError) throw itemsError;

    if (noteItems !== undefined) {
      await localDB.delivery_note_items.clear(); // limpia items viejos
      if (noteItems.length > 0) {
        await localDB.delivery_note_items.bulkAdd(noteItems as DeliveryNoteItemDB[]);
        console.log(`✅ ${noteItems.length} items de remitos sincronizados`);
      } else {
        console.log("✅ 0 items de remitos sincronizados (tabla vacía)");
      }
    }

    // Sincronizar request_items
    const { data: requestItems, error: requestError } = await supabase
      .from("request_items")
      .select("*")
      .eq("user_id", user.id);
    if (requestError) throw requestError;

    if (requestItems !== undefined) {
      await localDB.request_items.clear(); // limpia items del carrito viejos
      if (requestItems.length > 0) {
        await localDB.request_items.bulkAdd(requestItems as RequestItemDB[]);
        console.log(`✅ ${requestItems.length} items del carrito sincronizados`);
      } else {
        console.log("✅ 0 items del carrito sincronizados (tabla vacía)");
      }
    }

    // Sincronizar stock_items
    const { data: stockItems, error: stockError } = await supabase
      .from("stock_items")
      .select("*")
      .eq("user_id", user.id);
    if (stockError) throw stockError;

    if (stockItems !== undefined) {
      await localDB.stock_items.clear(); // limpia stock viejo
      if (stockItems.length > 0) {
        await localDB.stock_items.bulkAdd(stockItems as StockItemDB[]);
        console.log(`✅ ${stockItems.length} productos de stock sincronizados`);
      } else {
        console.log("✅ 0 productos de stock sincronizados (tabla vacía)");
      }
    }

    // Sincronizar settings (dólar oficial, etc.)
    console.log("📥 Sincronizando settings...");
    const { data: settingsData, error: settingsError } = await supabase.from("settings").select("*");
    if (settingsError) throw settingsError;

    if (settingsData !== undefined) {
      await localDB.settings.clear(); // limpia settings viejos
      if (settingsData.length > 0) {
        await localDB.settings.bulkAdd(
          settingsData.map((s: any) => ({
            key: s.key,
            value: s.value,
            updated_at: s.updated_at,
            created_at: s.created_at,
          })),
        );
        console.log(`✅ ${settingsData.length} setting(s) sincronizado(s)`);
      } else {
        console.log("✅ 0 settings sincronizados (tabla vacía)");
      }
    }

    console.log("✅ Sincronización completa desde Supabase");
    // const totalItems = (suppliers?.length || 0) + (productLists?.length || 0) + (productsIndex?.length || 0);
    // if (totalItems > 0) {
    //   toast.success(`${totalItems} elementos sincronizados para uso offline`);
    // }
  } catch (error) {
    console.error("❌ Error al sincronizar desde Supabase:", error);
    toast.error("Error al sincronizar datos");
    throw error;
  }
}

// ==================== COLA DE OPERACIONES PENDIENTES ====================

/**
 * Sanitiza datos según la tabla destino
 */
function sanitizeDataForSync(tableName: string, operationType: string, data: any): any {
  const cleanData = { ...data };
  delete cleanData.id;
  delete cleanData.items;
  
  if (tableName === "delivery_notes") {
    if (cleanData.issue_date) {
      cleanData.issue_date = new Date(cleanData.issue_date).toISOString();
    }
    
    if (cleanData.total_amount !== undefined) {
      cleanData.total_amount = Number(cleanData.total_amount);
    }
    if (cleanData.paid_amount !== undefined) {
      cleanData.paid_amount = Number(cleanData.paid_amount);
    }
    if (cleanData.remaining_balance !== undefined) {
      cleanData.remaining_balance = Number(cleanData.remaining_balance);
    }
  }
  
  if (tableName === "delivery_note_items") {
    if (cleanData.quantity !== undefined) {
      cleanData.quantity = Number(cleanData.quantity);
    }
    if (cleanData.unit_price !== undefined) {
      cleanData.unit_price = Number(cleanData.unit_price);
    }
    if (cleanData.subtotal !== undefined) {
      cleanData.subtotal = Number(cleanData.subtotal);
    }
  }
  
  return cleanData;
}

export async function queueOperation(
  tableName: string,
  operationType: "INSERT" | "UPDATE" | "DELETE",
  recordId: string,
  data: any,
): Promise<void> {
  const sanitizedData = sanitizeDataForSync(tableName, operationType, data);
  
  const operation: PendingOperation = {
    table_name: tableName,
    operation_type: operationType,
    record_id: recordId,
    data: sanitizedData,
    timestamp: Date.now(),
    retry_count: 0,
  };

  await localDB.pending_operations.add(operation);
  console.log(`📝 Operación encolada: ${operationType} en ${tableName}`);
}

/**
 * Versión de queueOperation que retorna el ID de la operación
 */
async function queueOperationWithId(
  tableName: string,
  operationType: "INSERT" | "UPDATE" | "DELETE",
  recordId: string,
  data: any,
): Promise<number> {
  const sanitizedData = sanitizeDataForSync(tableName, operationType, data);
  
  const operation: PendingOperation = {
    table_name: tableName,
    operation_type: operationType,
    record_id: recordId,
    data: sanitizedData,
    timestamp: Date.now(),
    retry_count: 0,
  };

  const id = await localDB.pending_operations.add(operation);
  console.log(`📝 Operación encolada: ${operationType} ${tableName} ${recordId} (id=${id})`);
  return id as number;
}

/**
 * Resuelve IDs temporales a IDs reales de Supabase
 */
async function resolveRecordId(tableName: string, recordId: string): Promise<string> {
  if (!isTempId(recordId)) return recordId;
  
  const mapping = await localDB.id_mappings.get(recordId);
  return mapping?.real_id || recordId;
}

/**
 * Actualiza referencias locales después de crear registro en Supabase
 */
async function updateLocalRecordId(tableName: string, tempId: string, realId: string): Promise<void> {
  console.log(`🔄 Mapeando ID: ${tempId} -> ${realId}`);
  
  await localDB.id_mappings.put({
    temp_id: tempId,
    real_id: realId,
    table_name: tableName,
    created_at: new Date().toISOString()
  });
  
  if (tableName === "delivery_notes") {
    const note = await localDB.delivery_notes.get(tempId);
    if (note) {
      await localDB.delivery_notes.delete(tempId);
      await localDB.delivery_notes.put({ ...note, id: realId });
      
      const items = await localDB.delivery_note_items
        .where("delivery_note_id")
        .equals(tempId)
        .toArray();
      
      for (const item of items) {
        await localDB.delivery_note_items.put({
          ...item,
          delivery_note_id: realId
        });
      }
    }
  }
}

export async function syncPendingOperations(): Promise<void> {
  if (!isOnline()) {
    console.warn("⚠️ No hay conexión. No se pueden sincronizar operaciones pendientes");
    return;
  }

  const operations = await localDB.pending_operations.toArray();

  if (operations.length === 0) {
    console.log("✅ No hay operaciones pendientes");
    return;
  }

  console.log(`🔄 Sincronizando ${operations.length} operaciones pendientes...`);

  const sortedOps = operations.sort((a, b) => a.timestamp - b.timestamp);

  let successCount = 0;
  let errorCount = 0;

  for (const op of sortedOps) {
    try {
      await executeOperation(op);
      await localDB.pending_operations.delete(op.id!);
      
      await clearStockCompensation(op.id!);
      
      successCount++;
    } catch (error: any) {
      errorCount++;
      console.error(`❌ Error al sincronizar operación ${op.id}:`, error);

      const updatedOp = await localDB.pending_operations.get(op.id!);
      if (updatedOp) {
        const newRetryCount = op.retry_count + 1;
        
        await localDB.pending_operations.put({
          ...updatedOp,
          retry_count: newRetryCount,
          error: error.message,
        });

        if (newRetryCount >= 3) {
          console.error(`❌ Operación ${op.id} descartada después de 3 intentos`);
          
          await rollbackStockCompensation(op.id!);
          
          await localDB.pending_operations.delete(op.id!);
          
          toast.error(`Operación fallida: ${op.table_name} - Stock revertido`);
        }
      }
    }
  }

  console.log(`✅ Sincronización completada: ${successCount} exitosas, ${errorCount} fallidas`);

  if (successCount > 0) {
    toast.success(`${successCount} operaciones sincronizadas`);
    // Re-sincronizar desde Supabase para obtener IDs reales
    //await syncFromSupabase();
  }

  if (errorCount > 0) {
    toast.error(`${errorCount} operaciones fallaron`);
  }
}

async function executeOperation(op: PendingOperation): Promise<void> {
  console.log(`🔄 Ejecutando: ${op.operation_type} ${op.table_name} ${op.record_id}`);

  const realId = await resolveRecordId(op.table_name, op.record_id);
  
  if (op.operation_type === "INSERT") {
    const { data, error } = await supabase
      .from(op.table_name)
      .insert([op.data])
      .select()
      .single();

    if (error) throw error;
    
    if (data && isTempId(op.record_id)) {
      await updateLocalRecordId(op.table_name, op.record_id, data.id);
    }
    
  } else if (op.operation_type === "UPDATE") {
    if (isTempId(realId)) {
      console.warn(`⚠️ No se puede actualizar registro con ID temporal: ${realId}`);
      throw new Error(`ID temporal no resuelto: ${realId}`);
    }
    
    const { error } = await supabase
      .from(op.table_name)
      .update(op.data)
      .eq("id", realId);

    if (error) throw error;
    
  } else if (op.operation_type === "DELETE") {
    if (isTempId(realId)) {
      console.log(`✅ Skip DELETE de registro temporal: ${realId}`);
      return;
    }
    
    const { error } = await supabase
      .from(op.table_name)
      .delete()
      .eq("id", realId);

    if (error) throw error;
  }

  console.log(`✅ Operación completada: ${op.operation_type} ${op.table_name}`);
}

/**
 * Refresca el índice de productos de una lista específica
 */
async function refreshProductListIndex(listId: string): Promise<void> {
  console.log(`🔄 Refrescando índice para lista: ${listId}`);
  
  const { error } = await supabase.rpc("refresh_list_index", { p_list_id: listId });
  
  if (error) {
    console.error("❌ Error al refrescar índice:", error);
    throw error;
  }
  
  console.log(`✅ Índice refrescado para lista: ${listId}`);
}

/**
 * Refresca índices de productos afectados por un remito
 */
async function refreshAffectedProductsIndex(deliveryNoteId: string): Promise<void> {
  console.log(`🔄 Refrescando índices de productos del remito: ${deliveryNoteId}`);

  // Obtener items del remito
  const { data: items, error } = await supabase
    .from("delivery_note_items")
    .select("product_id, dynamic_products!inner(list_id)")
    .eq("delivery_note_id", deliveryNoteId);

  if (error) {
    console.error("❌ Error al obtener items del remito:", error);
    return;
  }

  // Obtener listas únicas afectadas
  const affectedLists = new Set<string>();
  items?.forEach((item: any) => {
    if (item.dynamic_products?.list_id) {
      affectedLists.add(item.dynamic_products.list_id);
    }
  });

  // Refrescar índice de cada lista
  for (const listId of affectedLists) {
    await refreshProductListIndex(listId);
  }

  console.log(`✅ Índices refrescados para ${affectedLists.size} listas`);
}

/**
 * Sincroniza un remito específico desde Supabase a IndexedDB
 */
export async function syncDeliveryNoteById(noteId: string): Promise<void> {
  console.log(`🔄 Sincronizando remito ${noteId} a IndexedDB...`);

  const { data: noteData, error: noteError } = await supabase
    .from("delivery_notes")
    .select("*")
    .eq("id", noteId)
    .maybeSingle();

  if (noteError) throw noteError;

  if (!noteData) {
    // Si no existe en Supabase, eliminar de IndexedDB
    await localDB.delivery_notes.delete(noteId);
    await localDB.delivery_note_items.where("delivery_note_id").equals(noteId).delete();
    console.log(`✅ Remito ${noteId} eliminado de IndexedDB`);
    return;
  }

  // Actualizar remito en IndexedDB
  await localDB.delivery_notes.put(noteData as DeliveryNoteDB);

  // Sincronizar items del remito
  const { data: itemsData, error: itemsError } = await supabase
    .from("delivery_note_items")
    .select("*")
    .eq("delivery_note_id", noteId);

  if (itemsError) throw itemsError;

  // Eliminar items viejos
  await localDB.delivery_note_items.where("delivery_note_id").equals(noteId).delete();

  // Insertar items nuevos
  if (itemsData && itemsData.length > 0) {
    await localDB.delivery_note_items.bulkAdd(itemsData as DeliveryNoteItemDB[]);
  }

  console.log(`✅ Remito ${noteId} sincronizado a IndexedDB con ${itemsData?.length || 0} items`);
}

/**
 * Sincroniza múltiples remitos a IndexedDB (útil después de operaciones masivas)
 */
export async function syncDeliveryNotesToLocal(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  console.log("🔄 Sincronizando todos los remitos a IndexedDB...");

  // Sincronizar delivery_notes
  const { data: notes, error: notesError } = await supabase
    .from("delivery_notes")
    .select("*")
    .eq("user_id", user.id);

  if (notesError) throw notesError;

  await localDB.delivery_notes.clear();
  if (notes && notes.length > 0) {
    await localDB.delivery_notes.bulkAdd(notes as DeliveryNoteDB[]);
  }

  // Sincronizar delivery_note_items
  const { data: items, error: itemsError } = await supabase
    .from("delivery_note_items")
    .select("*");

  if (itemsError) throw itemsError;

  await localDB.delivery_note_items.clear();
  if (items && items.length > 0) {
    await localDB.delivery_note_items.bulkAdd(items as DeliveryNoteItemDB[]);
  }

  console.log(`✅ ${notes?.length || 0} remitos y ${items?.length || 0} items sincronizados a IndexedDB`);
}

/**
 * Refresca los datos de remitos en memoria después de operaciones offline
 */
export async function refreshDeliveryNotesCache(): Promise<DeliveryNoteDB[]> {
  const notes = await localDB.delivery_notes.toArray();
  const items = await localDB.delivery_note_items.toArray();
  
  return notes.map(note => ({
    ...note,
    items: items.filter(item => item.delivery_note_id === note.id)
  })) as any;
}

// ==================== OPERACIONES CRUD OFFLINE ====================

// SUPPLIERS
export async function createSupplierOffline(
  supplier: Omit<SupplierDB, "id" | "created_at" | "updated_at">,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  const tempId = generateTempId();
  const now = new Date().toISOString();

  const newSupplier: SupplierDB = {
    id: tempId,
    ...supplier,
    user_id: user.id,
    created_at: now,
    updated_at: now,
  };

  await localDB.suppliers.add(newSupplier);
  await queueOperation("suppliers", "INSERT", tempId, newSupplier);

  return tempId;
}

// PRODUCT LISTS
export async function createProductListOffline(data: {
  supplierId: string;
  name: string;
  fileName: string;
  fileType: string;
  columnSchema: any[];
  products: any[];
}): Promise<{ id: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  const tempId = generateTempId();
  const now = new Date().toISOString();

  const listData: ProductListDB = {
    id: tempId,
    user_id: user.id,
    supplier_id: data.supplierId,
    name: data.name,
    file_name: data.fileName,
    file_type: data.fileType,
    product_count: data.products.length,
    column_schema: data.columnSchema,
    created_at: now,
    updated_at: now,
  };

  await localDB.product_lists.add(listData);
  await queueOperation("product_lists", "INSERT", tempId, listData);

  // Agregar productos
  const productsToAdd = data.products.map((p) => ({
    id: crypto.randomUUID(),
    user_id: user.id,
    list_id: tempId,
    code: p.code,
    name: p.name,
    price: p.price,
    quantity: p.quantity,
    data: p.data,
    created_at: now,
    updated_at: now,
  }));

  await localDB.dynamic_products.bulkAdd(productsToAdd);

  // Encolar operación de productos (se sincronizarán cuando se cree la lista)
  for (const product of productsToAdd) {
    await queueOperation("dynamic_products", "INSERT", product.id, product);
  }

  return { id: tempId };
}

export async function updateProductListOffline(
  listId: string,
  data: {
    fileName: string;
    columnSchema: any[];
    products: any[];
  },
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  const existing = await localDB.product_lists.get(listId);
  if (!existing) throw new Error("Lista no encontrada");

  const now = new Date().toISOString();

  // 1. Actualizar metadatos
  const updates = {
    file_name: data.fileName,
    product_count: data.products.length,
    column_schema: data.columnSchema,
    updated_at: now,
  };

  await localDB.product_lists.update(listId, updates);
  await queueOperation("product_lists", "UPDATE", listId, updates);

  // 2. Obtener productos existentes
  const existingProducts = await localDB.dynamic_products.where("list_id").equals(listId).toArray();

  const existingByCode = new Map(existingProducts.map((p) => [p.code, { id: p.id, quantity: p.quantity }]));

  const existingIds = new Set(existingProducts.map((p) => p.id));
  const updatedIds = new Set<string>();

  // 3. UPSERT: Actualizar existentes e insertar nuevos
  for (const product of data.products) {
    if (product.code && existingByCode.has(product.code)) {
      // ✅ UPDATE: Producto existe
      const existing = existingByCode.get(product.code)!;
      updatedIds.add(existing.id);

      await localDB.dynamic_products.update(existing.id, {
        name: product.name,
        price: product.price,
        data: product.data,
        updated_at: now,
      });

      await queueOperation("dynamic_products", "UPDATE", existing.id, {
        name: product.name,
        price: product.price,
        data: product.data,
        updated_at: now,
      });
    } else {
      // ✅ INSERT: Producto nuevo
      const newId = crypto.randomUUID();
      updatedIds.add(newId);

      const newProduct = {
        id: newId,
        user_id: user.id,
        list_id: listId,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
        data: product.data,
        created_at: now,
        updated_at: now,
      };

      await localDB.dynamic_products.add(newProduct);
      await queueOperation("dynamic_products", "INSERT", newId, newProduct);
    }
  }

  // 4. DELETE: Eliminar productos obsoletos
  const idsToDelete = Array.from(existingIds).filter((id) => !updatedIds.has(id));

  for (const id of idsToDelete) {
    await localDB.dynamic_products.delete(id);
    await queueOperation("dynamic_products", "DELETE", id, {});
  }

  // 5. Limpiar y regenerar índice local
  await localDB.dynamic_products_index.where("list_id").equals(listId).delete();

  const updatedProducts = await localDB.dynamic_products.where("list_id").equals(listId).toArray();

  // Mapear productos al formato de índice
  const indexEntries = updatedProducts.map((p) => ({
    id: crypto.randomUUID(),
    user_id: p.user_id,
    list_id: p.list_id,
    product_id: p.id,
    code: p.code,
    name: p.name,
    price: p.price,
    quantity: p.quantity,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  await localDB.dynamic_products_index.bulkAdd(indexEntries);

  console.log(
    `✅ [Offline] UPSERT completado: ${updatedIds.size} productos actualizados/insertados, ${idsToDelete.length} eliminados`,
  );
}

export async function deleteProductListOffline(listId: string): Promise<void> {
  await localDB.product_lists.delete(listId);
  await localDB.dynamic_products.where("list_id").equals(listId).delete();
  await localDB.dynamic_products_index.where("list_id").equals(listId).delete();
  await queueOperation("product_lists", "DELETE", listId, {});
}

// Helpers para sincronización puntual de listas de productos
export async function upsertProductListLocalRecord(
  list: Pick<ProductListDB, "id"> & Partial<Omit<ProductListDB, "id">>,
): Promise<void> {
  const existing = await localDB.product_lists.get(list.id);
  if (!existing && (!list.user_id || !list.supplier_id || !list.name)) {
    throw new Error("Datos insuficientes para crear la lista localmente");
  }

  const now = new Date().toISOString();
  const record: ProductListDB = {
    id: list.id,
    user_id: list.user_id || existing?.user_id || "",
    supplier_id: list.supplier_id || existing?.supplier_id || "",
    name: list.name ?? existing?.name ?? "",
    file_name: list.file_name ?? existing?.file_name ?? "",
    file_type: list.file_type ?? existing?.file_type ?? "",
    product_count: list.product_count ?? existing?.product_count ?? 0,
    column_schema: list.column_schema ?? existing?.column_schema ?? [],
    mapping_config: list.mapping_config ?? existing?.mapping_config,
    created_at: list.created_at || existing?.created_at || now,
    updated_at: list.updated_at || now,
  };

  await localDB.product_lists.put(record);
}

export async function deleteProductListLocalRecord(listId: string): Promise<void> {
  await localDB.product_lists.delete(listId);
  await localDB.dynamic_products.where("list_id").equals(listId).delete();
  await localDB.dynamic_products_index.where("list_id").equals(listId).delete();
}

export async function replaceListProductsLocalData(
  listId: string,
  products: DynamicProductDB[] = [],
  indexEntries: DynamicProductIndexDB[] = [],
): Promise<void> {
  await localDB.dynamic_products.where("list_id").equals(listId).delete();
  if (products.length > 0) {
    await localDB.dynamic_products.bulkAdd(products);
  }

  await localDB.dynamic_products_index.where("list_id").equals(listId).delete();
  if (indexEntries.length > 0) {
    await localDB.dynamic_products_index.bulkAdd(indexEntries);
  }
}

export async function syncProductListById(listId: string): Promise<void> {
  if (!isOnline()) {
    console.warn("⚠️ Sin conexión. No se puede sincronizar la lista", listId);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  const { data: listData, error: listError } = await supabase
    .from("product_lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();
  if (listError) throw listError;

  if (!listData) {
    await deleteProductListLocalRecord(listId);
    return;
  }

  await upsertProductListLocalRecord(listData as ProductListDB);

  const { data: productsData, error: productsError } = await supabase
    .from("dynamic_products")
    .select("*")
    .eq("list_id", listId);
  if (productsError) throw productsError;

  const { data: indexData, error: indexError } = await supabase
    .from("dynamic_products_index")
    .select("*")
    .eq("list_id", listId);
  if (indexError) throw indexError;

  await replaceListProductsLocalData(listId, (productsData as DynamicProductDB[]) || [], (indexData as DynamicProductIndexDB[]) || []);
}

export async function updateSupplierOffline(id: string, updates: Partial<SupplierDB>): Promise<void> {
  const existing = await localDB.suppliers.get(id);
  if (!existing) throw new Error("Proveedor no encontrado");

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await localDB.suppliers.put(updated);
  await queueOperation("suppliers", "UPDATE", id, updates);
}

export async function deleteSupplierOffline(id: string): Promise<void> {
  await localDB.suppliers.delete(id);
  await queueOperation("suppliers", "DELETE", id, {});
}

// Helpers para sincronizar proveedores específicos cuando hay conexión
export async function upsertSupplierLocalRecord(
  supplier: Pick<SupplierDB, "id" | "name"> & Partial<Pick<SupplierDB, "logo_url" | "user_id" | "created_at" | "updated_at">>,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await localDB.suppliers.get(supplier.id);

  const record: SupplierDB = {
    id: supplier.id,
    user_id: supplier.user_id || existing?.user_id || "",
    name: supplier.name || existing?.name || "",
    logo_url: supplier.logo_url ?? existing?.logo_url,
    created_at: supplier.created_at || existing?.created_at || now,
    updated_at: supplier.updated_at || now,
  };

  await localDB.suppliers.put(record);
}

export async function deleteSupplierLocalRecord(id: string): Promise<void> {
  await localDB.suppliers.delete(id);
}

/**
 * Actualiza stock y registra compensación para rollback
 */
async function updateProductQuantityDeltaWithCompensation(
  productId: string,
  quantityDelta: number,
  operationId: number
): Promise<void> {
  await updateProductQuantityDelta(productId, quantityDelta);
  
  await localDB.stock_compensations.add({
    operation_id: operationId,
    product_id: productId,
    quantity_delta: quantityDelta,
    timestamp: Date.now()
  });
  
  console.log(`📊Compensación registrada: producto=${productId}, delta=${quantityDelta}`);
}

/**
 * Revierte cambios de stock si la operación falla
 */
async function rollbackStockCompensation(operationId: number): Promise<void> {
  const compensations = await localDB.stock_compensations
    .where("operation_id")
    .equals(operationId)
    .toArray();
  
  console.log(`🔄 Revirtiendo ${compensations.length} cambios de stock...`);
  
  for (const comp of compensations) {
    await updateProductQuantityDelta(comp.product_id, -comp.quantity_delta);
    console.log(`  ✅ Revertido: producto=${comp.product_id}, delta=${-comp.quantity_delta}`);
  }
  
  await localDB.stock_compensations
    .where("operation_id")
    .equals(operationId)
    .delete();
}

/**
 * Limpia compensaciones exitosas
 */
async function clearStockCompensation(operationId: number): Promise<void> {
  await localDB.stock_compensations
    .where("operation_id")
    .equals(operationId)
    .delete();
}

// DELIVERY NOTES
export async function createDeliveryNoteOffline(
  note: Omit<DeliveryNoteDB, "id" | "created_at" | "updated_at">,
  items: Omit<DeliveryNoteItemDB, "id" | "delivery_note_id" | "created_at">[],
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  const tempNoteId = generateTempId();
  const now = new Date().toISOString();

  const newNote: DeliveryNoteDB = {
    id: tempNoteId,
    ...note,
    user_id: user.id,
    created_at: now,
    updated_at: now,
  };

  await localDB.delivery_notes.add(newNote);
  
  const operationId = await queueOperationWithId("delivery_notes", "INSERT", tempNoteId, newNote);

  for (const item of items) {
    const tempItemId = generateTempId();
    const newItem: DeliveryNoteItemDB = {
      id: tempItemId,
      delivery_note_id: tempNoteId,
      ...item,
      created_at: now,
    };

    await localDB.delivery_note_items.add(newItem);
    await queueOperation("delivery_note_items", "INSERT", tempItemId, newItem);

    if (item.product_id) {
      await updateProductQuantityDeltaWithCompensation(
        item.product_id,
        -item.quantity,
        operationId
      );
    }
  }

  console.log(`✅ Remito ${tempNoteId} creado offline con compensación de stock`);
  return tempNoteId;
}

export async function updateDeliveryNoteOffline(
  id: string,
  updates: Partial<DeliveryNoteDB>,
  items?: Omit<DeliveryNoteItemDB, "id" | "delivery_note_id" | "created_at">[],
): Promise<void> {
  const existing = await localDB.delivery_notes.get(id);
  if (!existing) throw new Error("Remito no encontrado");

  const now = new Date().toISOString();

  // Si se proporcionan items, reemplazarlos con reversión de stock
  if (items !== undefined) {
    // PASO 1: Obtener items antiguos para revertir stock
    const oldItems = await localDB.delivery_note_items
      .where("delivery_note_id")
      .equals(id)
      .toArray();

    console.log(`🔄 Actualizando remito offline ${id}:`);
    console.log(`  Items antiguos: ${oldItems.length}`);
    console.log(`  Items nuevos: ${items.length}`);

    // PASO 2: Revertir stock de items antiguos
    for (const oldItem of oldItems) {
      if (oldItem.product_id) {
        console.log(`  ✅ Revirtiendo: ${oldItem.product_name} (+${oldItem.quantity})`);
        await updateProductQuantityDelta(oldItem.product_id, oldItem.quantity); // Delta positivo
      }
    }

    // PASO 3: Eliminar items antiguos
    await localDB.delivery_note_items
      .where("delivery_note_id")
      .equals(id)
      .delete();

    // Encolar eliminación de items antiguos
    for (const oldItem of oldItems) {
      await queueOperation("delivery_note_items", "DELETE", oldItem.id, {});
    }

    // PASO 4: Insertar nuevos items y descontar stock
    for (const item of items) {
      const itemId = crypto.randomUUID();
      const newItem: DeliveryNoteItemDB = {
        id: itemId,
        delivery_note_id: id,
        ...item,
        created_at: now,
      };

      await localDB.delivery_note_items.add(newItem);
      await queueOperation("delivery_note_items", "INSERT", itemId, newItem);

      // Descontar nuevo stock
      if (item.product_id) {
        console.log(`  ✅ Descontando: ${item.product_name} (-${item.quantity})`);
        await updateProductQuantityDelta(item.product_id, -item.quantity); // Delta negativo
      }
    }
  }

  // PASO 5: Actualizar nota principal
  const updated = {
    ...existing,
    ...updates,
    updated_at: now,
  };

  await localDB.delivery_notes.put(updated);
  await queueOperation("delivery_notes", "UPDATE", id, updates);

  console.log(`✅ Remito ${id} actualizado offline con reversión de stock`);
}

export async function deleteDeliveryNoteOffline(id: string): Promise<void> {
  const note = await localDB.delivery_notes.get(id);
  if (!note) throw new Error("Remito no encontrado");

  console.log(`🗑️ Eliminando remito offline: ${id}`);

  // PASO 1: Obtener items para revertir stock
  const items = await localDB.delivery_note_items
    .where("delivery_note_id")
    .equals(id)
    .toArray();

  // PASO 2: Revertir stock antes de eliminar (delta POSITIVO)
  for (const item of items) {
    if (item.product_id) {
      console.log(`  ⬆️ Revirtiendo: ${item.product_name} (+${item.quantity})`);
      await updateProductQuantityDelta(item.product_id, item.quantity);
    }
  }

  // PASO 3: Eliminar items de la base de datos
  await localDB.delivery_note_items
    .where("delivery_note_id")
    .equals(id)
    .delete();

  for (const item of items) {
    await queueOperation("delivery_note_items", "DELETE", item.id, {});
  }

  // PASO 4: Eliminar nota
  await localDB.delivery_notes.delete(id);
  await queueOperation("delivery_notes", "DELETE", id, {});

  console.log(`✅ Remito ${id} eliminado offline con reversión de stock`);
}

export async function markDeliveryNoteAsPaidOffline(id: string, paidAmount: number): Promise<void> {
  const note = await localDB.delivery_notes.get(id);
  if (!note) throw new Error("Remito no encontrado");

  const remainingBalance = note.total_amount - paidAmount;
  const status = remainingBalance <= 0 ? "paid" : "pending";

  const updates = {
    paid_amount: paidAmount,
    remaining_balance: remainingBalance,
    status,
    updated_at: new Date().toISOString(),
  };

  await localDB.delivery_notes.put({
    ...note,
    ...updates,
  });
  await queueOperation("delivery_notes", "UPDATE", id, updates);
}

// PRODUCTOS - Actualizar cantidad (privada, usa delta)
/**
 * Actualiza la cantidad de un producto en modo offline
 * Delta positivo = aumentar stock, Delta negativo = reducir stock
 */
async function updateProductQuantityDelta(productId: string, quantityDelta: number): Promise<void> {
  console.log(`📦 Actualizando stock offline: productId=${productId}, delta=${quantityDelta}`);

  // PASO 1: Buscar en dynamic_products_index usando product_id
  const indexRecord = await localDB.dynamic_products_index
    .where({ product_id: productId })
    .first();

  if (!indexRecord) {
    console.warn(`⚠️ Producto ${productId} no encontrado en índice local`);
    return;
  }

  // PASO 2: Calcular nueva cantidad (no permitir negativos)
  const currentQuantity = indexRecord.quantity || 0;
  const newQuantity = Math.max(0, currentQuantity + quantityDelta);

  console.log(`  Cantidad actual: ${currentQuantity}, Nueva cantidad: ${newQuantity}`);

  // PASO 3: Actualizar en dynamic_products_index
  await localDB.dynamic_products_index.update(indexRecord.id!, {
    quantity: newQuantity,
    updated_at: new Date().toISOString(),
  });

  // PASO 4: Actualizar en dynamic_products (tabla principal)
  const fullProduct = await localDB.dynamic_products.get(productId);
  if (fullProduct) {
    await localDB.dynamic_products.update(productId, {
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    });

    // PASO 5: Encolar operación para sincronizar cuando haya conexión
    await queueOperation("dynamic_products", "UPDATE", productId, {
      quantity: newQuantity,
    });

    console.log(`✅ Stock actualizado offline: ${productId} -> ${newQuantity}`);
  } else {
    console.warn(`⚠️ Producto ${productId} no encontrado en dynamic_products`);
  }
}

// DYNAMIC PRODUCTS - Operaciones offline públicas
export async function updateProductQuantityOffline(
  productId: string,
  listId: string,
  newQuantity: number,
): Promise<void> {
  // Actualizar en dynamic_products_index
  const indexRecord = await localDB.dynamic_products_index.where({ product_id: productId, list_id: listId }).first();

  if (indexRecord) {
    await localDB.dynamic_products_index.put({
      ...indexRecord,
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    });
  }

  // Actualizar en dynamic_products
  const productRecord = await localDB.dynamic_products.get(productId);
  if (productRecord) {
    await localDB.dynamic_products.put({
      ...productRecord,
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    });
  }

  // Encolar operación para sincronizar
  await queueOperation("dynamic_products_index", "UPDATE", productId, { quantity: newQuantity });
}

export async function getProductsForListOffline(
  listId: string,
  page: number = 0,
  pageSize: number = 50,
  searchQuery?: string,
): Promise<{ data: any[]; hasMore: boolean; total: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  // Obtener todos los productos del list_id del usuario
  let allRecords = await localDB.dynamic_products_index.where({ list_id: listId, user_id: user.id }).toArray();

  // Aplicar búsqueda si existe
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    allRecords = allRecords.filter(
      (r) => r.code?.toLowerCase().includes(lowerQuery) || r.name?.toLowerCase().includes(lowerQuery),
    );
  }

  // Ordenar por nombre
  allRecords.sort((a, b) => {
    const nameA = a.name || "";
    const nameB = b.name || "";
    return nameA.localeCompare(nameB);
  });

  const total = allRecords.length;
  const offset = page * pageSize;
  const paginatedRecords = allRecords.slice(offset, offset + pageSize);

  // Enriquecer con data de dynamic_products
  const enrichedData = await Promise.all(
    paginatedRecords.map(async (indexRecord) => {
      const fullProduct = await localDB.dynamic_products.get(indexRecord.product_id);
      return {
        product_id: indexRecord.product_id,
        list_id: indexRecord.list_id,
        code: indexRecord.code,
        name: indexRecord.name,
        price: indexRecord.price,
        quantity: indexRecord.quantity,
        dynamic_products: fullProduct ? { data: fullProduct.data } : null,
      };
    }),
  );

  return {
    data: enrichedData,
    hasMore: offset + pageSize < total,
    total,
  };
}

// REQUEST ITEMS (Carrito)
export async function addToCartOffline(productId: string, quantity: number = 1): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  // Verificar si ya existe
  const existing = await localDB.request_items.where("product_id").equals(productId).first();

  if (existing) {
    const newQuantity = existing.quantity + quantity;
    await localDB.request_items.put({ ...existing, quantity: newQuantity });
    await queueOperation("request_items", "UPDATE", existing.id, { quantity: newQuantity });
    return existing.id;
  }

  const tempId = generateTempId();
  const newItem: RequestItemDB = {
    id: tempId,
    user_id: user.id,
    product_id: productId,
    quantity,
    created_at: new Date().toISOString(),
  };

  await localDB.request_items.add(newItem);
  await queueOperation("request_items", "INSERT", tempId, newItem);

  return tempId;
}

export async function updateCartItemOffline(id: string, quantity: number): Promise<void> {
  const existing = await localDB.request_items.get(id);
  if (existing) {
    await localDB.request_items.put({ ...existing, quantity });
    await queueOperation("request_items", "UPDATE", id, { quantity });
  }
}

export async function removeFromCartOffline(id: string): Promise<void> {
  await localDB.request_items.delete(id);
  await queueOperation("request_items", "DELETE", id, {});
}

export async function clearCartOffline(): Promise<void> {
  const items = await localDB.request_items.toArray();
  for (const item of items) {
    await localDB.request_items.delete(item.id);
    await queueOperation("request_items", "DELETE", item.id, {});
  }
}

// ==================== STOCK ITEMS ====================

export async function createStockItemOffline(
  item: Omit<StockItemDB, "id" | "created_at" | "updated_at">,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  const tempId = generateTempId();
  const now = new Date().toISOString();

  const newItem: StockItemDB = {
    id: tempId,
    ...item,
    user_id: user.id,
    created_at: now,
    updated_at: now,
  };

  await localDB.stock_items.add(newItem);
  await queueOperation("stock_items", "INSERT", tempId, newItem);

  return tempId;
}

export async function updateStockItemOffline(id: string, updates: Partial<StockItemDB>): Promise<void> {
  const existing = await localDB.stock_items.get(id);
  if (!existing) throw new Error("Producto no encontrado");

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await localDB.stock_items.put(updated);
  await queueOperation("stock_items", "UPDATE", id, updates);
}

export async function deleteStockItemOffline(id: string): Promise<void> {
  await localDB.stock_items.delete(id);
  await queueOperation("stock_items", "DELETE", id, {});
}

// ==================== MANEJO DE TOKENS DE SESIÓN ====================

export async function saveAuthToken(
  userId: string,
  refreshToken: string,
  accessToken?: string,
  expiresAt?: number,
): Promise<void> {
  const tokenData: AuthTokenDB = {
    userId,
    refreshToken,
    accessToken,
    expiresAt,
    updatedAt: new Date().toISOString(),
  };

  await localDB.tokens.put(tokenData);
  console.log("🔐 Token de sesión guardado en IndexedDB");
}

export async function getAuthToken(): Promise<AuthTokenDB | undefined> {
  const token = await localDB.tokens.toCollection().first();
  return token;
}

export async function clearAuthToken(): Promise<void> {
  await localDB.tokens.clear();
  console.log("🗑️ Tokens de sesión eliminados de IndexedDB");
}

export async function clearAllLocalData(): Promise<void> {
  console.log("🗑️ Limpiando todos los datos locales...");

  try {
    await localDB.delete();
    await localDB.open();
    console.log("✅ Todos los datos locales eliminados");
  } catch (error) {
    console.error("❌ Error al limpiar datos locales:", error);
    throw error;
  }
}

// Helper para obtener dólar oficial offline
export async function getOfficialDollarRate(): Promise<number> {
  try {
    const setting = await localDB.settings.get("dollar_official");
    if (!setting || !setting.value || !setting.value.rate) {
      return 0;
    }
    return setting.value.rate;
  } catch (error) {
    console.error("Error obteniendo dólar oficial offline:", error);
    return 0;
  }
}

/**
 * Limpia operaciones pendientes muy antiguas (más de 7 días)
 */
export async function cleanupOldOperations(): Promise<void> {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const oldOps = await localDB.pending_operations
    .where("timestamp")
    .below(sevenDaysAgo)
    .toArray();
  
  if (oldOps.length === 0) return;
  
  console.log(`🗑️ Limpiando ${oldOps.length} operaciones antiguas...`);
  
  for (const op of oldOps) {
    await rollbackStockCompensation(op.id!);
    await localDB.pending_operations.delete(op.id!);
  }
  
  toast.info(`${oldOps.length} operaciones obsoletas eliminadas`);
}

// ==================== OBTENER DATOS OFFLINE ====================

export async function getOfflineData<T>(tableName: string): Promise<T[]> {
  switch (tableName) {
    case "suppliers":
      return (await localDB.suppliers.toArray()) as any;
    case "product_lists":
      return (await localDB.product_lists.toArray()) as any;
    case "dynamic_products_index":
      return (await localDB.dynamic_products_index.toArray()) as any;
    case "dynamic_products":
      return (await localDB.dynamic_products.toArray()) as any;
    case "delivery_notes":
      return (await localDB.delivery_notes.toArray()) as any;
    case "delivery_note_items":
      return (await localDB.delivery_note_items.toArray()) as any;
    case "request_items":
      return (await localDB.request_items.toArray()) as any;
    case "stock_items":
      return (await localDB.stock_items.toArray()) as any;
    default:
      throw new Error(`Tabla no soportada: ${tableName}`);
  }
}

// ==================== AUTO-SINCRONIZACIÓN ====================

// Escuchar eventos de conexión
if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    console.log("🌐 Conexión restaurada. Iniciando sincronización...");
    toast.info("Conexión restaurada. Sincronizando datos...");

    try {
      await syncPendingOperations();
      await syncFromSupabase();
    } catch (error) {
      console.error("Error en sincronización automática:", error);
    }
  });

  window.addEventListener("offline", () => {
    console.log("📡 Sin conexión. Trabajando en modo offline");
    toast.warning("Sin conexión. Los cambios se sincronizarán automáticamente");
  });
}
