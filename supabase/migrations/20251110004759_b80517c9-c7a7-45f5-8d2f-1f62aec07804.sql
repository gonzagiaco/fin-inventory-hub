-- Agregar columna para almacenar datos calculados con overrides
ALTER TABLE dynamic_products_index 
ADD COLUMN IF NOT EXISTS calculated_data jsonb DEFAULT '{}'::jsonb;

-- Crear índice GIN para búsquedas eficientes en calculated_data
CREATE INDEX IF NOT EXISTS idx_dynamic_products_index_calculated_data 
ON dynamic_products_index USING gin(calculated_data);

-- Función helper para calcular precios con modificadores
CREATE OR REPLACE FUNCTION calculate_price_with_modifiers(
  base_value text,
  percentage numeric DEFAULT 0,
  add_vat boolean DEFAULT false,
  vat_rate numeric DEFAULT 21
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  parsed_price numeric;
  result numeric;
BEGIN
  -- Normalizar precio base usando la función existente
  parsed_price := parse_price_string(base_value);
  
  IF parsed_price IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Aplicar porcentaje de modificador
  result := parsed_price * (1 + percentage / 100);
  
  -- Aplicar IVA si está activado
  IF add_vat THEN
    result := result * (1 + vat_rate / 100);
  END IF;
  
  -- Redondear a 2 decimales
  RETURN ROUND(result, 2);
END;
$$;

-- Reemplazar función refresh_list_index para calcular precios preservando datos originales
CREATE OR REPLACE FUNCTION public.refresh_list_index(p_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mapping jsonb;
  v_user_id uuid;
  override_key text;
  override_config jsonb;
  calculated_data_result jsonb;
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
        override_key,
        calculate_price_with_modifiers(
          dp.data->>override_key,
          (override_config->>'percentage')::numeric,
          (override_config->>'add_vat')::boolean,
          COALESCE(
            (override_config->>'vat_rate')::numeric,
            (v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric,
            21
          )
        )
      )
      FROM jsonb_each(COALESCE(v_mapping->'price_modifiers'->'overrides', '{}'::jsonb)) AS ov(override_key, override_config)
      WHERE dp.data ? override_key
    ) AS calculated_data
  FROM dynamic_products dp
  WHERE dp.list_id = p_list_id;

  RAISE NOTICE 'Índice refrescado para lista %: % productos indexados', 
    p_list_id, 
    (SELECT COUNT(*) FROM dynamic_products_index WHERE list_id = p_list_id);
END;
$$;