-- Actualizar función upsert_products_batch para emparejar por código usando dynamic_products_index
CREATE OR REPLACE FUNCTION public.upsert_products_batch(
  p_list_id uuid,
  p_user_id uuid,
  p_products jsonb
)
RETURNS TABLE(inserted_count int, updated_count int, deleted_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_deleted int := 0;
  v_product jsonb;
  v_mapping jsonb;
  v_dollar_rate numeric;
  v_dollar_columns jsonb;
  v_global_dollar_rate numeric;
  v_calculated_price numeric;
  v_search_text text;
  v_calculated_data jsonb;
  v_existing_id uuid;
  v_preserved_quantity integer;
  v_valid_codes_count int;
BEGIN
  -- 1. Obtener mapping_config de la lista
  SELECT mapping_config 
  INTO v_mapping
  FROM product_lists 
  WHERE id = p_list_id;

  -- 2. Obtener tasa dólar global (para cálculos de precio)
  SELECT (value->>'rate')::numeric 
  INTO v_global_dollar_rate
  FROM public.settings 
  WHERE key = 'dollar_official';

  v_dollar_rate := COALESCE(
    v_global_dollar_rate,
    (v_mapping->'dollar_conversion'->>'rate')::numeric,
    0
  );
  v_dollar_columns := COALESCE(v_mapping->'dollar_conversion'->'target_columns', '[]'::jsonb);

  -- 3. Recorrer productos para UPSERT
  FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
  LOOP
    -- Buscar producto existente **usando el índice por código**
    WITH existing AS (
      SELECT product_id 
      FROM dynamic_products_index
      WHERE list_id = p_list_id 
        AND code = v_product->>'code'
      LIMIT 1
    )
    SELECT product_id 
    INTO v_existing_id 
    FROM existing;

    -- Obtener cantidad previa del índice (si existe)
    WITH preserved AS (
      SELECT quantity 
      FROM dynamic_products_index
      WHERE list_id = p_list_id 
        AND code = v_product->>'code'
      LIMIT 1
    )
    SELECT quantity 
    INTO v_preserved_quantity 
    FROM preserved;

    -- Si no había cantidad preservada, usar la del archivo
    IF v_preserved_quantity IS NULL THEN
      v_preserved_quantity := (v_product->>'quantity')::integer;
    END IF;

    -- Calcular precio con modificadores (basado en mapping_config)
    v_calculated_price := apply_dollar_conversion(
      calculate_price_with_modifiers(
        CASE 
          WHEN v_mapping->>'price_primary_key' IS NOT NULL THEN 
            v_product->'data'->>((v_mapping->>'price_primary_key')::text)
          ELSE 
            COALESCE(v_product->>'price', '0')
        END,
        COALESCE((v_mapping->'price_modifiers'->'general'->>'percentage')::numeric, 0),
        COALESCE((v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean, false),
        COALESCE((v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric, 21)
      ),
      CASE 
        WHEN v_dollar_rate > 0 
             AND v_dollar_columns ? (v_mapping->>'price_primary_key') 
        THEN v_dollar_rate 
        ELSE 0 
      END
    );

    -- Texto de búsqueda combinando código y nombre
    v_search_text := COALESCE(v_product->>'code', '') || ' ' || COALESCE(v_product->>'name', '');

    -- Calcular datos calculados (p.ej. precios convertidos) para columnas objetivo de dólar
    SELECT jsonb_object_agg(col_key, value)
    INTO v_calculated_data
    FROM (
      WITH override_keys AS (
        SELECT jsonb_object_keys(coalesce(v_mapping->'price_modifiers'->'overrides','{}'::jsonb)) AS col_key
      ),
      target_keys AS (
        SELECT jsonb_array_elements_text(v_dollar_columns) AS col_key
      ),
      all_keys AS (
        SELECT DISTINCT col_key FROM (
          SELECT col_key FROM override_keys
          UNION ALL
          SELECT col_key FROM target_keys
        ) u
      )
      SELECT
        col_key,
        CASE
          WHEN v_mapping->'price_modifiers'->'overrides' ? col_key THEN
            to_jsonb(
              apply_dollar_conversion(
                calculate_price_with_modifiers(
                  v_product->'data'->>col_key,
                  (v_mapping->'price_modifiers'->'overrides'->col_key->>'percentage')::numeric,
                  (v_mapping->'price_modifiers'->'overrides'->col_key->>'add_vat')::boolean,
                  COALESCE(
                    (v_mapping->'price_modifiers'->'overrides'->col_key->>'vat_rate')::numeric,
                    (v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric,
                    21
                  )
                ),
                CASE WHEN v_dollar_rate > 0 AND (v_dollar_columns ? col_key) THEN v_dollar_rate ELSE 0 END
              )
            )
          WHEN v_dollar_columns ? col_key THEN
            to_jsonb(
              apply_dollar_conversion(
                parse_price_string(v_product->'data'->>col_key),
                CASE WHEN v_dollar_rate > 0 THEN v_dollar_rate ELSE 0 END
              )
            )
          ELSE
            to_jsonb(parse_price_string(v_product->'data'->>col_key))
        END AS value
      FROM all_keys
      WHERE v_product->'data' ? col_key
    ) s;

    IF v_existing_id IS NOT NULL THEN
      -- **UPDATE**: actualizar producto existente
      UPDATE dynamic_products
      SET 
        code = v_product->>'code',         -- (Opcional: llenar el código si estaba vacío)
        name = v_product->>'name',
        price = (v_product->>'price')::numeric,
        data = v_product->'data',
        updated_at = now()
      WHERE id = v_existing_id;

      UPDATE dynamic_products_index
      SET
        name = v_product->>'name',
        price = v_calculated_price,
        quantity = v_preserved_quantity,
        search_vector = to_tsvector('spanish', v_search_text),
        calculated_data = COALESCE(v_calculated_data, '{}'::jsonb),
        updated_at = now()
      WHERE product_id = v_existing_id;

      v_updated := v_updated + 1;
    ELSE
      -- **INSERT**: insertar nuevo producto
      INSERT INTO dynamic_products (
        user_id, list_id, code, name, price, quantity, data, created_at, updated_at
      )
      VALUES (
        p_user_id, p_list_id,
        v_product->>'code',
        v_product->>'name',
        (v_product->>'price')::numeric,
        v_preserved_quantity,
        v_product->'data',
        now(), now()
      )
      RETURNING id INTO v_existing_id;

      INSERT INTO dynamic_products_index (
        user_id, list_id, product_id, code, name, price, quantity,
        search_vector, calculated_data, created_at, updated_at
      )
      VALUES (
        p_user_id, p_list_id, v_existing_id,
        v_product->>'code',
        v_product->>'name',
        v_calculated_price,
        v_preserved_quantity,
        to_tsvector('spanish', v_search_text),
        COALESCE(v_calculated_data, '{}'::jsonb),
        now(), now()
      );

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- 4. Eliminar productos obsoletos sólo si hay códigos válidos
  WITH new_codes AS (
    SELECT DISTINCT TRIM(elem->>'code') AS code
    FROM jsonb_array_elements(p_products) elem
    WHERE elem->>'code' IS NOT NULL AND TRIM(elem->>'code') != ''
  )
  SELECT COUNT(*) INTO v_valid_codes_count FROM new_codes;

  IF v_valid_codes_count > 0 THEN
    WITH new_codes AS (
      SELECT DISTINCT TRIM(elem->>'code') AS code
      FROM jsonb_array_elements(p_products) elem
      WHERE elem->>'code' IS NOT NULL AND TRIM(elem->>'code') != ''
    )
    DELETE FROM dynamic_products dp
    WHERE dp.list_id = p_list_id
      AND dp.code NOT IN (SELECT code FROM new_codes);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    RAISE NOTICE 'No hay códigos válidos en el payload, omitiendo DELETE';
    v_deleted := 0;
  END IF;

  -- Limpieza: eliminar entradas huérfanas en el índice que quedaron sin producto padre
  DELETE FROM dynamic_products_index dpi
  WHERE dpi.list_id = p_list_id
    AND NOT EXISTS (
      SELECT 1 FROM dynamic_products dp 
      WHERE dp.id = dpi.product_id
    );

  RAISE NOTICE 'UPSERT completado: % insertados, % actualizados, % eliminados', 
    v_inserted, v_updated, v_deleted;

  RETURN QUERY SELECT v_inserted, v_updated, v_deleted;
END;
$$;