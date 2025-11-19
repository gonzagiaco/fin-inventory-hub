-- Fix dollar conversion logic: Apply to all selected columns regardless of overrides

CREATE OR REPLACE FUNCTION public.refresh_list_index(p_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mapping jsonb;
  v_user_id uuid;
  v_dollar_rate numeric;
  v_dollar_columns jsonb;
BEGIN
  -- Obtener mapping_config y user_id de la lista
  SELECT mapping_config, user_id 
  INTO v_mapping, v_user_id
  FROM product_lists 
  WHERE id = p_list_id;

  -- Si no hay mapping_config, no hacer nada
  IF v_mapping IS NULL THEN
    RAISE NOTICE 'Lista % no tiene mapping_config configurado', p_list_id;
    RETURN;
  END IF;

  -- Extraer configuración de conversión de dólar
  v_dollar_rate := COALESCE((v_mapping->'dollar_conversion'->>'rate')::numeric, 0);
  v_dollar_columns := COALESCE(v_mapping->'dollar_conversion'->'target_columns', '[]'::jsonb);

  -- PASO 1: Guardar cantidades actuales (editadas manualmente)
  CREATE TEMP TABLE IF NOT EXISTS temp_quantities (
    product_id uuid PRIMARY KEY,
    quantity integer
  ) ON COMMIT DROP;
  
  TRUNCATE temp_quantities;
  
  INSERT INTO temp_quantities (product_id, quantity)
  SELECT product_id, quantity 
  FROM dynamic_products_index 
  WHERE list_id = p_list_id;

  -- PASO 2: Eliminar índices existentes
  DELETE FROM dynamic_products_index 
  WHERE list_id = p_list_id;

  -- PASO 3: Insertar nuevos índices con datos actualizados
  INSERT INTO dynamic_products_index (
    user_id,
    list_id,
    product_id,
    code,
    name,
    price,
    quantity,
    search_vector,
    calculated_data
  )
  SELECT 
    dp.user_id,
    dp.list_id,
    dp.id,
    -- CODE
    COALESCE(
      (SELECT (dp.data->>key)::text 
       FROM jsonb_array_elements_text(v_mapping->'code_keys') AS key
       WHERE dp.data->>key IS NOT NULL 
       LIMIT 1),
      dp.code
    ) AS code,
    -- NAME
    COALESCE(
      (SELECT (dp.data->>key)::text 
       FROM jsonb_array_elements_text(v_mapping->'name_keys') AS key
       WHERE dp.data->>key IS NOT NULL 
       LIMIT 1),
      dp.name
    ) AS name,
    -- PRICE: Solo aplicar conversión si price_primary_key está en target_columns
    apply_dollar_conversion(
      calculate_price_with_modifiers(
        CASE 
          WHEN v_mapping->>'price_primary_key' IS NOT NULL 
          THEN dp.data->>((v_mapping->>'price_primary_key')::text)
          ELSE COALESCE(dp.price::text, '0')
        END,
        COALESCE((v_mapping->'price_modifiers'->'general'->>'percentage')::numeric, 0),
        COALESCE((v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean, false),
        COALESCE((v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric, 21)
      ),
      CASE 
        WHEN v_dollar_rate > 0 AND v_dollar_columns ? (v_mapping->>'price_primary_key') 
        THEN v_dollar_rate 
        ELSE 0 
      END
    ) AS price,
    -- QUANTITY (temporal, del archivo)
    CASE 
      WHEN v_mapping->>'quantity_key' IS NOT NULL 
      THEN (dp.data->>((v_mapping->>'quantity_key')::text))::integer
      ELSE dp.quantity
    END AS quantity,
    -- Search vector
    to_tsvector('spanish', 
      COALESCE(
        (SELECT string_agg(dp.data->>key, ' ')
         FROM jsonb_array_elements_text(
           COALESCE(v_mapping->'code_keys', '[]'::jsonb) || 
           COALESCE(v_mapping->'name_keys', '[]'::jsonb) || 
           COALESCE(v_mapping->'extra_index_keys', '[]'::jsonb)
         ) AS key
         WHERE dp.data->>key IS NOT NULL),
        ''
      ) || ' ' ||
      COALESCE(dp.code, '') || ' ' ||
      COALESCE(dp.name, '')
    ) AS search_vector,
    -- Calculated data: columnas que estén en target_columns O tengan override
    (
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
      SELECT jsonb_object_agg(
        col_key,
        CASE
          WHEN v_mapping->'price_modifiers'->'overrides' ? col_key THEN
            apply_dollar_conversion(
              calculate_price_with_modifiers(
                dp.data->>col_key,
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
          WHEN v_dollar_columns ? col_key THEN
            apply_dollar_conversion(
              parse_price_string(dp.data->>col_key),
              CASE WHEN v_dollar_rate > 0 THEN v_dollar_rate ELSE 0 END
            )
          ELSE
            parse_price_string(dp.data->>col_key)
        END
      )
      FROM all_keys
      WHERE dp.data ? col_key
    ) AS calculated_data
  FROM dynamic_products dp
  WHERE dp.list_id = p_list_id;

  -- PASO 4: RESTAURAR cantidades editadas (CRÍTICO)
  UPDATE dynamic_products_index dpi
  SET quantity = tq.quantity
  FROM temp_quantities tq
  WHERE dpi.product_id = tq.product_id
    AND dpi.list_id = p_list_id;

  RAISE NOTICE 'Índice refrescado para lista %: % productos, % cantidades preservadas, conversión dólar: %', 
    p_list_id, 
    (SELECT COUNT(*) FROM dynamic_products_index WHERE list_id = p_list_id),
    (SELECT COUNT(*) FROM temp_quantities),
    CASE WHEN v_dollar_rate > 0 THEN 'ACTIVA (' || v_dollar_rate || ')' ELSE 'INACTIVA' END;
END;
$function$;