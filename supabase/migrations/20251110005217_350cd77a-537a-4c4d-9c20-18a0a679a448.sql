-- Corregir función refresh_list_index para eliminar ambigüedad de override_key
CREATE OR REPLACE FUNCTION public.refresh_list_index(p_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mapping jsonb;
  v_user_id uuid;
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

  -- Eliminar índices existentes de esta lista
  DELETE FROM dynamic_products_index 
  WHERE list_id = p_list_id;

  -- Insertar nuevos índices con precios calculados
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
    -- Extraer CODE de las claves configuradas
    COALESCE(
      (SELECT (dp.data->>key)::text 
       FROM jsonb_array_elements_text(v_mapping->'code_keys') AS key
       WHERE dp.data->>key IS NOT NULL 
       LIMIT 1),
      dp.code
    ) AS code,
    -- Extraer NAME de las claves configuradas
    COALESCE(
      (SELECT (dp.data->>key)::text 
       FROM jsonb_array_elements_text(v_mapping->'name_keys') AS key
       WHERE dp.data->>key IS NOT NULL 
       LIMIT 1),
      dp.name
    ) AS name,
    -- Calcular PRICE principal con modificadores generales
    calculate_price_with_modifiers(
      CASE 
        WHEN v_mapping->>'price_primary_key' IS NOT NULL 
        THEN dp.data->>((v_mapping->>'price_primary_key')::text)
        ELSE COALESCE(dp.price::text, '0')
      END,
      COALESCE((v_mapping->'price_modifiers'->'general'->>'percentage')::numeric, 0),
      COALESCE((v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean, false),
      COALESCE((v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric, 21)
    ) AS price,
    -- Extraer QUANTITY
    CASE 
      WHEN v_mapping->>'quantity_key' IS NOT NULL 
      THEN (dp.data->>((v_mapping->>'quantity_key')::text))::integer
      ELSE dp.quantity
    END AS quantity,
    -- Crear vector de búsqueda
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
    -- Calcular columnas con overrides y almacenar en calculated_data
    (
      SELECT jsonb_object_agg(
        ov.key,
        calculate_price_with_modifiers(
          dp.data->>ov.key,
          (ov.value->>'percentage')::numeric,
          (ov.value->>'add_vat')::boolean,
          COALESCE(
            (ov.value->>'vat_rate')::numeric,
            (v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric,
            21
          )
        )
      )
      FROM jsonb_each(COALESCE(v_mapping->'price_modifiers'->'overrides', '{}'::jsonb)) AS ov(key, value)
      WHERE dp.data ? ov.key
    ) AS calculated_data
  FROM dynamic_products dp
  WHERE dp.list_id = p_list_id;

  RAISE NOTICE 'Índice refrescado para lista %: % productos indexados', 
    p_list_id, 
    (SELECT COUNT(*) FROM dynamic_products_index WHERE list_id = p_list_id);
END;
$function$;