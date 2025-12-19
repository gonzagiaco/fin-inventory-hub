-- A) COLUMNA in_my_stock EN dynamic_products_index
-- Criterio de Mi Stock = in_my_stock = true (reemplaza updated_at > created_at)

-- 1. Agregar columna in_my_stock
ALTER TABLE public.dynamic_products_index
ADD COLUMN IF NOT EXISTS in_my_stock boolean NOT NULL DEFAULT false;

-- 2. Backfill: marcar como in_my_stock = true donde quantity > 0
UPDATE public.dynamic_products_index
SET in_my_stock = true
WHERE quantity > 0;

-- 3. Crear índice para queries eficientes de Mi Stock
CREATE INDEX IF NOT EXISTS idx_dynamic_products_index_my_stock 
ON public.dynamic_products_index (user_id, in_my_stock) 
WHERE in_my_stock = true;

-- 4. Crear índice compuesto para búsquedas filtradas
CREATE INDEX IF NOT EXISTS idx_dynamic_products_index_list_my_stock 
ON public.dynamic_products_index (list_id, in_my_stock);

-- C) RPC bulkAdjustStock para operaciones masivas de Remitos
CREATE OR REPLACE FUNCTION public.bulk_adjust_stock(
  p_adjustments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_adjustment jsonb;
  v_product_id uuid;
  v_delta integer;
  v_list_id uuid;
  v_op_id text;
  v_current_qty integer;
  v_new_qty integer;
  v_results jsonb := '[]'::jsonb;
  v_processed_ops jsonb := '[]'::jsonb;
  v_user_id uuid;
BEGIN
  -- Obtener usuario autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Iterar sobre cada ajuste
  FOR v_adjustment IN SELECT * FROM jsonb_array_elements(p_adjustments)
  LOOP
    v_product_id := (v_adjustment->>'product_id')::uuid;
    v_delta := (v_adjustment->>'delta')::integer;
    v_list_id := (v_adjustment->>'list_id')::uuid;
    v_op_id := v_adjustment->>'op_id';
    
    -- Verificar que el producto pertenece al usuario
    SELECT quantity INTO v_current_qty
    FROM dynamic_products_index
    WHERE product_id = v_product_id AND user_id = v_user_id;
    
    IF NOT FOUND THEN
      CONTINUE; -- Skip productos no encontrados
    END IF;
    
    -- Calcular nueva cantidad (nunca negativa)
    v_new_qty := GREATEST(0, COALESCE(v_current_qty, 0) + v_delta);
    
    -- Actualizar dynamic_products_index
    UPDATE dynamic_products_index
    SET 
      quantity = v_new_qty,
      in_my_stock = CASE 
        WHEN v_new_qty > 0 THEN true
        WHEN v_delta < 0 AND v_new_qty = 0 THEN in_my_stock -- Mantener estado si era true
        ELSE in_my_stock
      END,
      updated_at = now()
    WHERE product_id = v_product_id AND user_id = v_user_id;
    
    -- Actualizar dynamic_products (tabla principal)
    UPDATE dynamic_products
    SET 
      quantity = v_new_qty,
      updated_at = now()
    WHERE id = v_product_id AND user_id = v_user_id;
    
    -- Agregar resultado
    v_results := v_results || jsonb_build_object(
      'product_id', v_product_id,
      'old_qty', v_current_qty,
      'new_qty', v_new_qty,
      'delta', v_delta,
      'op_id', v_op_id
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', jsonb_array_length(v_results),
    'results', v_results
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Comentario para documentación
COMMENT ON FUNCTION public.bulk_adjust_stock IS 
'Ajusta stock de múltiples productos en una sola transacción. 
Input: [{ product_id, delta, list_id, op_id }]
Output: { success, processed, results: [{ product_id, old_qty, new_qty }] }';