-- Crear función de normalización de números (igual que numberParser.ts)
CREATE OR REPLACE FUNCTION parse_price_string(input text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  str text;
  is_negative boolean;
  last_comma int;
  last_dot int;
  result numeric;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN NULL;
  END IF;
  
  str := TRIM(input);
  -- Eliminar símbolos no numéricos salvo coma y punto
  str := REGEXP_REPLACE(str, '[^0-9.,-]', '', 'g');
  
  IF str = '' THEN
    RETURN NULL;
  END IF;
  
  -- Manejar signos negativos
  is_negative := str LIKE '-%';
  IF is_negative THEN
    str := SUBSTRING(str FROM 2);
  END IF;
  
  last_comma := LENGTH(str) - LENGTH(REPLACE(str, ',', ''));
  last_dot := LENGTH(str) - LENGTH(REPLACE(str, '.', ''));
  
  -- Tiene coma y punto: decidir cuál es decimal según la posición
  IF last_comma > 0 AND last_dot > 0 THEN
    IF POSITION(',' IN REVERSE(str)) < POSITION('.' IN REVERSE(str)) THEN
      -- La coma está después del punto: formato "1.234,56"
      str := REPLACE(str, '.', '');
      str := REPLACE(str, ',', '.');
    ELSE
      -- El punto está después de la coma: formato "1,234.56"
      str := REPLACE(str, ',', '');
    END IF;
  ELSIF last_comma > 0 THEN
    -- Solo coma presente -> asumir coma decimal
    str := REPLACE(str, ',', '.');
  END IF;
  
  result := str::numeric;
  
  IF is_negative THEN
    result := -result;
  END IF;
  
  RETURN ROUND(result, 2);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Actualizar la función refresh_list_index para usar parse_price_string
CREATE OR REPLACE FUNCTION public.refresh_list_index(p_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    -- Extraer PRICE con normalización usando parse_price_string, modificadores y redondeo a 2 decimales
    ROUND(CASE 
      WHEN v_mapping->>'price_primary_key' IS NOT NULL THEN 
        -- Usar parse_price_string para normalizar correctamente
        parse_price_string(dp.data->>((v_mapping->>'price_primary_key')::text))
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
        COALESCE(dp.price, 0)
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
$$;

-- Ahora re-indexar todas las listas
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM product_lists LOOP
    PERFORM refresh_list_index(r.id);
    RAISE NOTICE 'Lista % re-indexada', r.id;
  END LOOP;
END$$;