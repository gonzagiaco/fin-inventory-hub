import Dexie, { Table } from 'dexie';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ==================== INTERFACES ====================

export interface PendingOperation {
  id?: number;
  table_name: string;
  operation_type: 'INSERT' | 'UPDATE' | 'DELETE';
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

  constructor() {
    super('ProveedoresLocalDB');
    
    this.version(1).stores({
      suppliers: 'id, user_id, name',
      product_lists: 'id, user_id, supplier_id, name',
      dynamic_products_index: 'id, user_id, list_id, product_id, code, name',
      dynamic_products: 'id, user_id, list_id, code, name',
      delivery_notes: 'id, user_id, customer_name, status, issue_date',
      delivery_note_items: 'id, delivery_note_id, product_id',
      request_items: 'id, user_id, product_id',
      stock_items: 'id, user_id, code, name, category, supplier_id',
      pending_operations: '++id, table_name, timestamp, record_id',
      tokens: 'userId, updatedAt'
    });
  }
}

export const localDB = new LocalDatabase();

// ==================== CONSTANTES ====================

const SYNC_ORDER = [
  'suppliers',
  'product_lists',
  'dynamic_products',
  'dynamic_products_index',
  'stock_items',
  'delivery_notes',
  'delivery_note_items',
  'request_items'
];

// ==================== UTILIDADES ====================

export function isOnline(): boolean {
  return navigator.onLine;
}

function generateTempId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isTempId(id: string): boolean {
  return id.startsWith('offline-');
}

// ==================== INICIALIZACIÓN ====================

export async function initDB(): Promise<void> {
  try {
    await localDB.open();
    console.log('✅ IndexedDB inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar IndexedDB:', error);
    throw error;
  }
}

// ==================== SINCRONIZACIÓN DESDE SUPABASE ====================

export async function syncFromSupabase(): Promise<void> {
  if (!isOnline()) {
    console.warn('⚠️ No hay conexión. No se puede sincronizar desde Supabase');
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    console.log('🔄 Iniciando sincronización desde Supabase...');

    // Sincronizar suppliers
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id);
    if (suppliersError) throw suppliersError;
    if (suppliers && suppliers.length > 0) {
      await localDB.suppliers.bulkPut(suppliers as SupplierDB[]);
      console.log(`✅ ${suppliers.length} proveedores sincronizados`);
    }

    // Sincronizar product_lists
    const { data: productLists, error: listsError } = await supabase
      .from('product_lists')
      .select('*')
      .eq('user_id', user.id);
    if (listsError) throw listsError;
    if (productLists && productLists.length > 0) {
      await localDB.product_lists.bulkPut(productLists as ProductListDB[]);
      console.log(`✅ ${productLists.length} listas de productos sincronizadas`);
    }

    // Sincronizar dynamic_products_index
    const { data: productsIndex, error: indexError } = await supabase
      .from('dynamic_products_index')
      .select('*')
      .eq('user_id', user.id);
    if (indexError) throw indexError;
    if (productsIndex && productsIndex.length > 0) {
      await localDB.dynamic_products_index.bulkPut(productsIndex as DynamicProductIndexDB[]);
      console.log(`✅ ${productsIndex.length} productos (index) sincronizados`);
    }

    // Sincronizar dynamic_products
    const { data: products, error: productsError } = await supabase
      .from('dynamic_products')
      .select('*')
      .eq('user_id', user.id);
    if (productsError) throw productsError;
    if (products && products.length > 0) {
      await localDB.dynamic_products.bulkPut(products as DynamicProductDB[]);
      console.log(`✅ ${products.length} productos completos sincronizados`);
    }

    // Sincronizar delivery_notes
    const { data: deliveryNotes, error: notesError } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('user_id', user.id);
    if (notesError) throw notesError;
    if (deliveryNotes && deliveryNotes.length > 0) {
      await localDB.delivery_notes.bulkPut(deliveryNotes as DeliveryNoteDB[]);
      console.log(`✅ ${deliveryNotes.length} remitos sincronizados`);
    }

    // Sincronizar delivery_note_items
    const { data: noteItems, error: itemsError } = await supabase
      .from('delivery_note_items')
      .select('*');
    if (itemsError) throw itemsError;
    if (noteItems && noteItems.length > 0) {
      await localDB.delivery_note_items.bulkPut(noteItems as DeliveryNoteItemDB[]);
      console.log(`✅ ${noteItems.length} items de remitos sincronizados`);
    }

    // Sincronizar request_items
    const { data: requestItems, error: requestError } = await supabase
      .from('request_items')
      .select('*')
      .eq('user_id', user.id);
    if (requestError) throw requestError;
    if (requestItems && requestItems.length > 0) {
      await localDB.request_items.bulkPut(requestItems as RequestItemDB[]);
      console.log(`✅ ${requestItems.length} items del carrito sincronizados`);
    }

    // Sincronizar stock_items
    const { data: stockItems, error: stockError } = await supabase
      .from('stock_items')
      .select('*')
      .eq('user_id', user.id);
    if (stockError) throw stockError;
    if (stockItems && stockItems.length > 0) {
      await localDB.stock_items.bulkPut(stockItems as StockItemDB[]);
      console.log(`✅ ${stockItems.length} productos de stock sincronizados`);
    }

    console.log('✅ Sincronización completa desde Supabase');
    toast.success('Datos sincronizados correctamente');
  } catch (error) {
    console.error('❌ Error al sincronizar desde Supabase:', error);
    toast.error('Error al sincronizar datos');
    throw error;
  }
}

// ==================== COLA DE OPERACIONES PENDIENTES ====================

export async function queueOperation(
  tableName: string,
  operationType: 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string,
  data: any
): Promise<void> {
  const operation: PendingOperation = {
    table_name: tableName,
    operation_type: operationType,
    record_id: recordId,
    data,
    timestamp: Date.now(),
    retry_count: 0
  };

  await localDB.pending_operations.add(operation);
  console.log(`📝 Operación encolada: ${operationType} en ${tableName}`);
}

export async function syncPendingOperations(): Promise<void> {
  if (!isOnline()) {
    console.warn('⚠️ No hay conexión. No se pueden sincronizar operaciones pendientes');
    return;
  }

  const operations = await localDB.pending_operations.toArray();
  
  if (operations.length === 0) {
    console.log('✅ No hay operaciones pendientes');
    return;
  }

  console.log(`🔄 Sincronizando ${operations.length} operaciones pendientes...`);
  
  // Ordenar operaciones por timestamp
  const sortedOps = operations.sort((a, b) => a.timestamp - b.timestamp);
  
  let successCount = 0;
  let errorCount = 0;

  for (const op of sortedOps) {
    try {
      await executeOperation(op);
      await localDB.pending_operations.delete(op.id!);
      successCount++;
    } catch (error: any) {
      errorCount++;
      console.error(`❌ Error al sincronizar operación ${op.id}:`, error);
      
      // Actualizar contador de reintentos
      const updatedOp = await localDB.pending_operations.get(op.id!);
      if (updatedOp) {
        await localDB.pending_operations.put({
          ...updatedOp,
          retry_count: op.retry_count + 1,
          error: error.message
        });
      }

      // Si ha fallado más de 3 veces, eliminar de la cola
      if (op.retry_count >= 3) {
        console.error(`❌ Operación ${op.id} descartada después de 3 intentos`);
        await localDB.pending_operations.delete(op.id!);
      }
    }
  }

  console.log(`✅ Sincronización completada: ${successCount} exitosas, ${errorCount} fallidas`);
  
  if (successCount > 0) {
    toast.success(`${successCount} operaciones sincronizadas`);
    // Re-sincronizar desde Supabase para obtener IDs reales
    await syncFromSupabase();
  }
  
  if (errorCount > 0) {
    toast.error(`${errorCount} operaciones fallaron`);
  }
}

async function executeOperation(op: PendingOperation): Promise<void> {
  const { table_name, operation_type, record_id, data } = op;

  // Si es un ID temporal, necesitamos manejarlo especialmente
  const isTemp = isTempId(record_id);

  switch (operation_type) {
    case 'INSERT':
      // Para INSERT, no enviamos el ID temporal
      const insertData = { ...data };
      if (isTemp) {
        delete insertData.id;
      }
      
      const { error: insertError } = await (supabase as any)
        .from(table_name)
        .insert(insertData);
      
      if (insertError) throw insertError;
      break;

    case 'UPDATE':
      // Para UPDATE, si tiene ID temporal, intentamos buscar por otros campos
      if (isTemp) {
        console.warn(`⚠️ No se puede actualizar registro con ID temporal: ${record_id}`);
        return;
      }
      
      const { error: updateError } = await (supabase as any)
        .from(table_name)
        .update(data)
        .eq('id', record_id);
      
      if (updateError) throw updateError;
      break;

    case 'DELETE':
      if (isTemp) {
        console.warn(`⚠️ No se puede eliminar registro con ID temporal: ${record_id}`);
        return;
      }
      
      const { error: deleteError } = await (supabase as any)
        .from(table_name)
        .delete()
        .eq('id', record_id);
      
      if (deleteError) throw deleteError;
      break;
  }
}

// ==================== OPERACIONES CRUD OFFLINE ====================

// SUPPLIERS
export async function createSupplierOffline(supplier: Omit<SupplierDB, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const tempId = generateTempId();
  const now = new Date().toISOString();
  
  const newSupplier: SupplierDB = {
    id: tempId,
    ...supplier,
    user_id: user.id,
    created_at: now,
    updated_at: now
  };

  await localDB.suppliers.add(newSupplier);
  await queueOperation('suppliers', 'INSERT', tempId, newSupplier);
  
  return tempId;
}

export async function updateSupplierOffline(id: string, updates: Partial<SupplierDB>): Promise<void> {
  const existing = await localDB.suppliers.get(id);
  if (!existing) throw new Error('Proveedor no encontrado');

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  await localDB.suppliers.put(updated);
  await queueOperation('suppliers', 'UPDATE', id, updates);
}

export async function deleteSupplierOffline(id: string): Promise<void> {
  await localDB.suppliers.delete(id);
  await queueOperation('suppliers', 'DELETE', id, {});
}

// DELIVERY NOTES
export async function createDeliveryNoteOffline(
  note: Omit<DeliveryNoteDB, 'id' | 'created_at' | 'updated_at'>,
  items: Omit<DeliveryNoteItemDB, 'id' | 'delivery_note_id' | 'created_at'>[]
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const tempNoteId = generateTempId();
  const now = new Date().toISOString();
  
  const newNote: DeliveryNoteDB = {
    id: tempNoteId,
    ...note,
    user_id: user.id,
    created_at: now,
    updated_at: now
  };

  await localDB.delivery_notes.add(newNote);
  await queueOperation('delivery_notes', 'INSERT', tempNoteId, newNote);

  // Crear items
  for (const item of items) {
    const tempItemId = generateTempId();
    const newItem: DeliveryNoteItemDB = {
      id: tempItemId,
      delivery_note_id: tempNoteId,
      ...item,
      created_at: now
    };
    
    await localDB.delivery_note_items.add(newItem);
    await queueOperation('delivery_note_items', 'INSERT', tempItemId, newItem);

    // Actualizar stock localmente
    if (item.product_id) {
      await updateProductQuantityOffline(item.product_id, -item.quantity);
    }
  }
  
  return tempNoteId;
}

export async function updateDeliveryNoteOffline(
  id: string,
  updates: Partial<DeliveryNoteDB>,
  items?: Omit<DeliveryNoteItemDB, 'id' | 'delivery_note_id' | 'created_at'>[]
): Promise<void> {
  const existing = await localDB.delivery_notes.get(id);
  if (!existing) throw new Error('Remito no encontrado');

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  await localDB.delivery_notes.put(updated);
  await queueOperation('delivery_notes', 'UPDATE', id, updates);

  // Si se proporcionan items, reemplazarlos
  if (items) {
    // Obtener items antiguos para revertir stock
    const oldItems = await localDB.delivery_note_items
      .where('delivery_note_id')
      .equals(id)
      .toArray();

    // Revertir stock de items antiguos
    for (const oldItem of oldItems) {
      if (oldItem.product_id) {
        await updateProductQuantityOffline(oldItem.product_id, oldItem.quantity);
      }
      await localDB.delivery_note_items.delete(oldItem.id);
      await queueOperation('delivery_note_items', 'DELETE', oldItem.id, {});
    }

    // Agregar nuevos items
    for (const item of items) {
      const tempItemId = generateTempId();
      const newItem: DeliveryNoteItemDB = {
        id: tempItemId,
        delivery_note_id: id,
        ...item,
        created_at: new Date().toISOString()
      };
      
      await localDB.delivery_note_items.add(newItem);
      await queueOperation('delivery_note_items', 'INSERT', tempItemId, newItem);

      // Actualizar stock
      if (item.product_id) {
        await updateProductQuantityOffline(item.product_id, -item.quantity);
      }
    }
  }
}

export async function deleteDeliveryNoteOffline(id: string): Promise<void> {
  // Obtener items para revertir stock
  const items = await localDB.delivery_note_items
    .where('delivery_note_id')
    .equals(id)
    .toArray();

  // Revertir stock
  for (const item of items) {
    if (item.product_id) {
      await updateProductQuantityOffline(item.product_id, item.quantity);
    }
    await localDB.delivery_note_items.delete(item.id);
    await queueOperation('delivery_note_items', 'DELETE', item.id, {});
  }

  await localDB.delivery_notes.delete(id);
  await queueOperation('delivery_notes', 'DELETE', id, {});
}

export async function markDeliveryNoteAsPaidOffline(id: string, paidAmount: number): Promise<void> {
  const note = await localDB.delivery_notes.get(id);
  if (!note) throw new Error('Remito no encontrado');

  const remainingBalance = note.total_amount - paidAmount;
  const status = remainingBalance <= 0 ? 'paid' : 'pending';

  const updates = {
    paid_amount: paidAmount,
    remaining_balance: remainingBalance,
    status,
    updated_at: new Date().toISOString()
  };

  await localDB.delivery_notes.put({
    ...note,
    ...updates
  });
  await queueOperation('delivery_notes', 'UPDATE', id, updates);
}

// PRODUCTOS - Actualizar cantidad
async function updateProductQuantityOffline(productId: string, quantityDelta: number): Promise<void> {
  // Actualizar en index
  const indexProduct = await localDB.dynamic_products_index.get(productId);
  if (indexProduct) {
    const newQuantity = Math.max(0, (indexProduct.quantity || 0) + quantityDelta);
    await localDB.dynamic_products_index.put({
      ...indexProduct,
      quantity: newQuantity,
      updated_at: new Date().toISOString()
    });
    await queueOperation('dynamic_products_index', 'UPDATE', productId, {
      quantity: newQuantity
    });
  }

  // Actualizar en productos completos
  const product = await localDB.dynamic_products.get(productId);
  if (product) {
    const newQuantity = Math.max(0, (product.quantity || 0) + quantityDelta);
    await localDB.dynamic_products.put({
      ...product,
      quantity: newQuantity,
      updated_at: new Date().toISOString()
    });
    await queueOperation('dynamic_products', 'UPDATE', productId, {
      quantity: newQuantity
    });
  }
}

// REQUEST ITEMS (Carrito)
export async function addToCartOffline(productId: string, quantity: number = 1): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  // Verificar si ya existe
  const existing = await localDB.request_items
    .where('product_id')
    .equals(productId)
    .first();

  if (existing) {
    const newQuantity = existing.quantity + quantity;
    await localDB.request_items.put({ ...existing, quantity: newQuantity });
    await queueOperation('request_items', 'UPDATE', existing.id, { quantity: newQuantity });
    return existing.id;
  }

  const tempId = generateTempId();
  const newItem: RequestItemDB = {
    id: tempId,
    user_id: user.id,
    product_id: productId,
    quantity,
    created_at: new Date().toISOString()
  };

  await localDB.request_items.add(newItem);
  await queueOperation('request_items', 'INSERT', tempId, newItem);
  
  return tempId;
}

export async function updateCartItemOffline(id: string, quantity: number): Promise<void> {
  const existing = await localDB.request_items.get(id);
  if (existing) {
    await localDB.request_items.put({ ...existing, quantity });
    await queueOperation('request_items', 'UPDATE', id, { quantity });
  }
}

export async function removeFromCartOffline(id: string): Promise<void> {
  await localDB.request_items.delete(id);
  await queueOperation('request_items', 'DELETE', id, {});
}

export async function clearCartOffline(): Promise<void> {
  const items = await localDB.request_items.toArray();
  for (const item of items) {
    await localDB.request_items.delete(item.id);
    await queueOperation('request_items', 'DELETE', item.id, {});
  }
}

// ==================== STOCK ITEMS ====================

export async function createStockItemOffline(
  item: Omit<StockItemDB, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const tempId = generateTempId();
  const now = new Date().toISOString();
  
  const newItem: StockItemDB = {
    id: tempId,
    ...item,
    user_id: user.id,
    created_at: now,
    updated_at: now
  };

  await localDB.stock_items.add(newItem);
  await queueOperation('stock_items', 'INSERT', tempId, newItem);
  
  return tempId;
}

export async function updateStockItemOffline(
  id: string,
  updates: Partial<StockItemDB>
): Promise<void> {
  const existing = await localDB.stock_items.get(id);
  if (!existing) throw new Error('Producto no encontrado');

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  await localDB.stock_items.put(updated);
  await queueOperation('stock_items', 'UPDATE', id, updates);
}

export async function deleteStockItemOffline(id: string): Promise<void> {
  await localDB.stock_items.delete(id);
  await queueOperation('stock_items', 'DELETE', id, {});
}

// ==================== MANEJO DE TOKENS DE SESIÓN ====================

export async function saveAuthToken(
  userId: string,
  refreshToken: string,
  accessToken?: string,
  expiresAt?: number
): Promise<void> {
  const tokenData: AuthTokenDB = {
    userId,
    refreshToken,
    accessToken,
    expiresAt,
    updatedAt: new Date().toISOString()
  };

  await localDB.tokens.put(tokenData);
  console.log('🔐 Token de sesión guardado en IndexedDB');
}

export async function getAuthToken(): Promise<AuthTokenDB | undefined> {
  const token = await localDB.tokens.toCollection().first();
  return token;
}

export async function clearAuthToken(): Promise<void> {
  await localDB.tokens.clear();
  console.log('🗑️ Tokens de sesión eliminados de IndexedDB');
}

export async function clearAllLocalData(): Promise<void> {
  console.log('🗑️ Limpiando todos los datos locales...');
  
  try {
    await localDB.delete();
    await localDB.open();
    console.log('✅ Todos los datos locales eliminados');
  } catch (error) {
    console.error('❌ Error al limpiar datos locales:', error);
    throw error;
  }
}

// ==================== OBTENER DATOS OFFLINE ====================

export async function getOfflineData<T>(tableName: string): Promise<T[]> {
  switch (tableName) {
    case 'suppliers':
      return (await localDB.suppliers.toArray()) as any;
    case 'product_lists':
      return (await localDB.product_lists.toArray()) as any;
    case 'dynamic_products_index':
      return (await localDB.dynamic_products_index.toArray()) as any;
    case 'dynamic_products':
      return (await localDB.dynamic_products.toArray()) as any;
    case 'delivery_notes':
      return (await localDB.delivery_notes.toArray()) as any;
    case 'delivery_note_items':
      return (await localDB.delivery_note_items.toArray()) as any;
    case 'request_items':
      return (await localDB.request_items.toArray()) as any;
    case 'stock_items':
      return (await localDB.stock_items.toArray()) as any;
    default:
      throw new Error(`Tabla no soportada: ${tableName}`);
  }
}

// ==================== AUTO-SINCRONIZACIÓN ====================

// Escuchar eventos de conexión
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('🌐 Conexión restaurada. Iniciando sincronización...');
    toast.info('Conexión restaurada. Sincronizando datos...');
    
    try {
      await syncPendingOperations();
      await syncFromSupabase();
    } catch (error) {
      console.error('Error en sincronización automática:', error);
    }
  });

  window.addEventListener('offline', () => {
    console.log('📡 Sin conexión. Trabajando en modo offline');
    toast.warning('Sin conexión. Los cambios se sincronizarán automáticamente');
  });
}
