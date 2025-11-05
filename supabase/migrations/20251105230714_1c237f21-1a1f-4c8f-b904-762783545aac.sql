-- Actualizar función refresh_list_index para limitar precios a 2 decimales
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

  -- Insertar nuevos índices basados en mapping_config
  INSERT INTO dynamic_products_index (
    user_id,
    list_id,
    product_id,
    code,
    name,
    price,
    quantity,
    search_vector
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
    -- Extraer PRICE con normalización, modificadores y redondeo a 2 decimales
    ROUND(CASE 
      WHEN v_mapping->>'price_primary_key' IS NOT NULL THEN 
        -- Normalizar el valor de precio: eliminar símbolos y convertir separadores
        (COALESCE(
          NULLIF(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                dp.data->>((v_mapping->>'price_primary_key')::text), 
                '[^0-9.,]', '', 'g'
              ),
              ',', '.', 'g'
            ), 
            ''
          ), 
          '0'
        ))::numeric
        -- Aplicar porcentaje de modificador (override o general)
        * (1 + COALESCE(
             (v_mapping->'price_modifiers'->'overrides'->(v_mapping->>'price_primary_key')->>'percentage')::numeric,
             (v_mapping->'price_modifiers'->'general'->>'percentage')::numeric,
             0
           ) / 100)
        -- Aplicar IVA si está configurado (21%)
        * CASE WHEN COALESCE(
              (v_mapping->'price_modifiers'->'overrides'->(v_mapping->>'price_primary_key')->>'add_vat')::boolean,
              (v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean,
              FALSE
            )
           THEN 1.21 ELSE 1 END
      ELSE 
        -- Si no hay columna de precio mapeada, usar dp.price con modificador general
        (dp.price)::numeric 
        * (1 + COALESCE((v_mapping->'price_modifiers'->'general'->>'percentage')::numeric, 0)/100)
        * CASE WHEN COALESCE((v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean, FALSE) 
           THEN 1.21 ELSE 1 END
    END, 2) AS price,
    -- Extraer QUANTITY
    CASE 
      WHEN v_mapping->>'quantity_key' IS NOT NULL 
      THEN (dp.data->>((v_mapping->>'quantity_key')::text))::integer
      ELSE dp.quantity
    END AS quantity,
    -- Crear vector de búsqueda con todas las claves relevantes
    to_tsvector('spanish', 
      COALESCE(
        (SELECT string_agg(dp.data->>key, ' ')
         FROM jsonb_array_elements_text(
           v_mapping->'code_keys' || 
           v_mapping->'name_keys' || 
           v_mapping->'extra_index_keys'
         ) AS key
         WHERE dp.data->>key IS NOT NULL),
        ''
      ) || ' ' ||
      COALESCE(dp.code, '') || ' ' ||
      COALESCE(dp.name, '')
    ) AS search_vector
  FROM dynamic_products dp
  WHERE dp.list_id = p_list_id;

  RAISE NOTICE 'Índice refrescado para lista %: % productos indexados', 
    p_list_id, 
    (SELECT COUNT(*) FROM dynamic_products_index WHERE list_id = p_list_id);
END;
$function$;