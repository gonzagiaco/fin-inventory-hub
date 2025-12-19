import { supabase } from "@/integrations/supabase/client";
import { localDB } from "@/lib/localDB";

export interface StockAdjustment {
  product_id: string;
  list_id: string;
  delta: number;
  op_id?: string;
}

export interface BulkAdjustResult {
  success: boolean;
  processed: number;
  results: Array<{
    product_id: string;
    old_qty: number;
    new_qty: number;
    delta: number;
    op_id?: string;
  }>;
  error?: string;
}

// Logging helper con métricas
const logBulk = (action: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[BulkStock ${timestamp}] ${action}`, details || '');
};

/**
 * C) bulkAdjustStock - Operaciones masivas para Remitos
 * Una sola llamada RPC para múltiples productos
 * Incluye idempotencia via op_id
 */
export async function bulkAdjustStock(
  adjustments: StockAdjustment[],
  isOnline: boolean
): Promise<BulkAdjustResult> {
  const startTime = performance.now();
  logBulk('Starting bulk adjustment', { 
    count: adjustments.length, 
    isOnline,
    products: adjustments.map(a => ({ id: a.product_id, delta: a.delta }))
  });

  if (adjustments.length === 0) {
    return { success: true, processed: 0, results: [] };
  }

  // Generar op_id único para idempotencia si no existe
  const adjustmentsWithOpId = adjustments.map(adj => ({
    ...adj,
    op_id: adj.op_id || `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }));

  if (isOnline) {
    try {
      // Usar RPC para operación atómica en servidor
      const { data, error } = await supabase.rpc('bulk_adjust_stock', {
        p_adjustments: adjustmentsWithOpId
      });

      if (error) {
        logBulk('ERROR RPC bulk_adjust_stock', error);
        throw error;
      }

      const result = data as unknown as BulkAdjustResult;
      
      const endTime = performance.now();
      logBulk(`RPC completed in ${(endTime - startTime).toFixed(2)}ms`, {
        processed: result.processed,
        success: result.success
      });

      // Sincronizar resultados a IndexedDB
      if (result.success && result.results) {
        await syncBulkResultsToLocal(result.results);
      }

      return result;
    } catch (error: any) {
      logBulk('ERROR online bulk adjustment, falling back to offline', error);
      // Fallback a modo offline
      return await bulkAdjustStockOffline(adjustmentsWithOpId);
    }
  } else {
    return await bulkAdjustStockOffline(adjustmentsWithOpId);
  }
}

/**
 * Versión offline de bulk adjust
 * Actualiza IndexedDB y encola operaciones
 */
async function bulkAdjustStockOffline(
  adjustments: StockAdjustment[]
): Promise<BulkAdjustResult> {
  const startTime = performance.now();
  logBulk('Starting offline bulk adjustment', { count: adjustments.length });

  const results: BulkAdjustResult['results'] = [];

  for (const adj of adjustments) {
    try {
      // Buscar producto en índice
      const indexRecord = await localDB.dynamic_products_index
        .where({ product_id: adj.product_id })
        .first();

      if (!indexRecord) {
        logBulk(`Product not found: ${adj.product_id}`);
        continue;
      }

      const oldQty = indexRecord.quantity || 0;
      const newQty = Math.max(0, oldQty + adj.delta);

      // Actualizar dynamic_products_index
      await localDB.dynamic_products_index.update(indexRecord.id!, {
        quantity: newQty,
        in_my_stock: newQty > 0 ? true : indexRecord.in_my_stock,
        updated_at: new Date().toISOString(),
      });

      // Actualizar dynamic_products
      const fullProduct = await localDB.dynamic_products.get(adj.product_id);
      if (fullProduct) {
        await localDB.dynamic_products.update(adj.product_id, {
          quantity: newQty,
          updated_at: new Date().toISOString(),
        });
      }

      // Encolar para sincronización (con serialización por producto)
      await localDB.pending_operations.add({
        table_name: 'dynamic_products_index',
        operation_type: 'UPDATE',
        record_id: adj.product_id,
        data: { 
          quantity: newQty,
          op_id: adj.op_id // Para idempotencia
        },
        timestamp: Date.now(),
        retry_count: 0,
      });

      results.push({
        product_id: adj.product_id,
        old_qty: oldQty,
        new_qty: newQty,
        delta: adj.delta,
        op_id: adj.op_id,
      });

    } catch (error) {
      logBulk(`ERROR adjusting product ${adj.product_id}`, error);
    }
  }

  const endTime = performance.now();
  logBulk(`Offline bulk completed in ${(endTime - startTime).toFixed(2)}ms`, {
    processed: results.length
  });

  return {
    success: true,
    processed: results.length,
    results,
  };
}

/**
 * Sincroniza resultados del RPC a IndexedDB
 */
async function syncBulkResultsToLocal(
  results: BulkAdjustResult['results']
): Promise<void> {
  logBulk('Syncing bulk results to IndexedDB', { count: results.length });

  for (const result of results) {
    const indexRecord = await localDB.dynamic_products_index
      .where({ product_id: result.product_id })
      .first();

    if (indexRecord) {
      await localDB.dynamic_products_index.update(indexRecord.id!, {
        quantity: result.new_qty,
        in_my_stock: result.new_qty > 0 ? true : indexRecord.in_my_stock,
        updated_at: new Date().toISOString(),
      });
    }

    // También actualizar dynamic_products
    const fullProduct = await localDB.dynamic_products.get(result.product_id);
    if (fullProduct) {
      await localDB.dynamic_products.update(result.product_id, {
        quantity: result.new_qty,
        updated_at: new Date().toISOString(),
      });
    }
  }

  logBulk('IndexedDB sync completed');
}

/**
 * Prepara ajustes de stock para un remito (crear/update/delete)
 */
export function prepareDeliveryNoteAdjustments(
  items: Array<{ productId?: string; quantity: number }>,
  operation: 'create' | 'delete' | 'revert'
): StockAdjustment[] {
  return items
    .filter(item => item.productId)
    .map(item => ({
      product_id: item.productId!,
      list_id: '', // Se llenará desde el producto
      delta: operation === 'delete' || operation === 'revert' 
        ? item.quantity // Devolver al stock
        : -item.quantity, // Descontar del stock
    }));
}
