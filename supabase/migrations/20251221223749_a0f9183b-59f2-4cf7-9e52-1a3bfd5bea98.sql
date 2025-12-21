-- Actualizar función refresh_list_index para preservar in_my_stock y stock_threshold
CREATE OR REPLACE FUNCTION public.refresh_list_index(p_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mapping jsonb;
  v_user_id uuid;
  v_dollar_rate numeric;
  v_dollar_columns jsonb;
  v_global_dollar_rate numeric;
begin
  -- Obtener mapping_config y user_id de la lista
  select mapping_config, user_id 
  into v_mapping, v_user_id
  from product_lists 
  where id = p_list_id;

  if v_mapping is null then
    raise notice 'Lista % no tiene mapping_config configurado', p_list_id;
    return;
  end if;

  -- Obtener rate GLOBAL desde settings
  select (value->>'rate')::numeric 
  into v_global_dollar_rate
  from public.settings 
  where key = 'dollar_official';

  -- Usar rate global, con fallback a mapping_config por compatibilidad
  v_dollar_rate := coalesce(
    v_global_dollar_rate,
    (v_mapping->'dollar_conversion'->>'rate')::numeric,
    0
  );

  -- Columnas donde aplicar conversión (desde mapping_config)
  v_dollar_columns := coalesce(v_mapping->'dollar_conversion'->'target_columns', '[]'::jsonb);

  -- PASO 1: Guardar datos del usuario (quantity, in_my_stock, stock_threshold)
  create temp table if not exists temp_preserved (
    product_id uuid primary key,
    quantity integer,
    in_my_stock boolean,
    stock_threshold integer
  ) on commit drop;
  
  truncate temp_preserved;
  
  insert into temp_preserved (product_id, quantity, in_my_stock, stock_threshold)
  select product_id, quantity, in_my_stock, stock_threshold 
  from dynamic_products_index 
  where list_id = p_list_id;

  -- PASO 2: Eliminar índices existentes
  delete from dynamic_products_index 
  where list_id = p_list_id;

  -- PASO 3: Insertar nuevos índices con datos actualizados
  insert into dynamic_products_index (
    user_id,
    list_id,
    product_id,
    code,
    name,
    price,
    quantity,
    search_vector,
    calculated_data,
    in_my_stock,
    stock_threshold
  )
  select 
    dp.user_id,
    dp.list_id,
    dp.id,
    -- CODE
    coalesce(
      (select (dp.data->>key)::text 
       from jsonb_array_elements_text(v_mapping->'code_keys') as key
       where dp.data->>key is not null 
       limit 1),
      dp.code
    ) as code,
    -- NAME
    coalesce(
      (select (dp.data->>key)::text 
       from jsonb_array_elements_text(v_mapping->'name_keys') as key
       where dp.data->>key is not null 
       limit 1),
      dp.name
    ) as name,
    -- PRICE: Solo aplicar conversión si price_primary_key está en target_columns
    apply_dollar_conversion(
      calculate_price_with_modifiers(
        case 
          when v_mapping->>'price_primary_key' is not null 
          then dp.data->>((v_mapping->>'price_primary_key')::text)
          else coalesce(dp.price::text, '0')
        end,
        coalesce((v_mapping->'price_modifiers'->'general'->>'percentage')::numeric, 0),
        coalesce((v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean, false),
        coalesce((v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric, 21)
      ),
      case 
        when v_dollar_rate > 0 and v_dollar_columns ? (v_mapping->>'price_primary_key') 
        then v_dollar_rate 
        else 0 
      end
    ) as price,
    -- QUANTITY (temporal, del archivo - se sobrescribirá con valor preservado)
    case 
      when v_mapping->>'quantity_key' is not null 
      then (dp.data->>((v_mapping->>'quantity_key')::text))::integer
      else dp.quantity
    end as quantity,
    -- Search vector
    to_tsvector('spanish', 
      coalesce(
        (select string_agg(dp.data->>key, ' ')
         from jsonb_array_elements_text(
           coalesce(v_mapping->'code_keys', '[]'::jsonb) || 
           coalesce(v_mapping->'name_keys', '[]'::jsonb) || 
           coalesce(v_mapping->'extra_index_keys', '[]'::jsonb)
         ) as key
         where dp.data->>key is not null),
        ''
      ) || ' ' ||
      coalesce(dp.code, '') || ' ' ||
      coalesce(dp.name, '')
    ) as search_vector,
    -- Calculated data
    (
      select jsonb_object_agg(
        col_key,
        case 
          when v_mapping->'price_modifiers'->'overrides' ? col_key then
            apply_dollar_conversion(
              calculate_price_with_modifiers(
                dp.data->>col_key,
                coalesce((v_mapping->'price_modifiers'->'overrides'->col_key->>'percentage')::numeric, 0),
                coalesce((v_mapping->'price_modifiers'->'overrides'->col_key->>'add_vat')::boolean, false),
                coalesce(
                  (v_mapping->'price_modifiers'->'overrides'->col_key->>'vat_rate')::numeric,
                  (v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric,
                  21
                )
              ),
              case when v_dollar_rate > 0 and v_dollar_columns ? col_key then v_dollar_rate else 0 end
            )
          when v_dollar_columns ? col_key then
            apply_dollar_conversion(
              parse_price_string(dp.data->>col_key),
              case when v_dollar_rate > 0 then v_dollar_rate else 0 end
            )
          else null
        end
      )
      from (
        select distinct col_key
        from (
          select jsonb_object_keys(v_mapping->'price_modifiers'->'overrides') as col_key
          where v_mapping->'price_modifiers'->'overrides' is not null
          union
          select jsonb_array_elements_text(v_dollar_columns) as col_key
        ) combined
        where dp.data ? col_key
      ) cols
    ) as calculated_data,
    -- Valores por defecto para in_my_stock y stock_threshold (se sobrescriben luego)
    false as in_my_stock,
    0 as stock_threshold
  from dynamic_products dp
  where dp.list_id = p_list_id;

  -- PASO 4: RESTAURAR datos del usuario (quantity, in_my_stock, stock_threshold)
  update dynamic_products_index dpi
  set 
    quantity = tp.quantity,
    in_my_stock = tp.in_my_stock,
    stock_threshold = tp.stock_threshold
  from temp_preserved tp
  where dpi.product_id = tp.product_id
    and dpi.list_id = p_list_id;

  raise notice 'Índice refrescado para lista %: % productos, % datos preservados, conversión dólar: % (fuente: %)', 
    p_list_id, 
    (select count(*) from dynamic_products_index where list_id = p_list_id),
    (select count(*) from temp_preserved),
    case when v_dollar_rate > 0 then 'ACTIVA ($' || v_dollar_rate || ')' else 'INACTIVA' end,
    case when v_global_dollar_rate is not null then 'GLOBAL' else 'LOCAL/FALLBACK' end;
end;
$function$;

-- Actualizar función upsert_products_batch para preservar in_my_stock y stock_threshold
CREATE OR REPLACE FUNCTION public.upsert_products_batch(p_list_id uuid, p_user_id uuid, p_products jsonb)
 RETURNS TABLE(inserted_count integer, updated_count integer, deleted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_preserved_in_my_stock boolean;
  v_preserved_stock_threshold integer;
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
    -- Buscar producto existente usando el índice por código
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

    -- Obtener valores previos del índice (quantity, in_my_stock, stock_threshold)
    WITH preserved AS (
      SELECT quantity, in_my_stock, stock_threshold 
      FROM dynamic_products_index
      WHERE list_id = p_list_id 
        AND code = v_product->>'code'
      LIMIT 1
    )
    SELECT quantity, in_my_stock, stock_threshold
    INTO v_preserved_quantity, v_preserved_in_my_stock, v_preserved_stock_threshold
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

    -- Calcular datos calculados para columnas objetivo de dólar
    SELECT jsonb_object_agg(
      col_key,
      CASE 
        WHEN v_mapping->'price_modifiers'->'overrides' ? col_key THEN
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
            CASE WHEN v_dollar_rate > 0 THEN v_dollar_rate ELSE 0 END
          )
        ELSE
          apply_dollar_conversion(
            parse_price_string(v_product->'data'->>col_key),
            CASE WHEN v_dollar_rate > 0 THEN v_dollar_rate ELSE 0 END
          )
      END
    )
    INTO v_calculated_data
    FROM jsonb_array_elements_text(v_dollar_columns) AS col_key
    WHERE v_product->'data' ? col_key;

    IF v_existing_id IS NOT NULL THEN
      -- UPDATE: actualizar producto existente (NO sobrescribir in_my_stock ni stock_threshold)
      UPDATE dynamic_products
      SET 
        code = v_product->>'code',
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
        -- NO tocamos in_my_stock ni stock_threshold aquí, se preservan
      WHERE product_id = v_existing_id;

      v_updated := v_updated + 1;
    ELSE
      -- INSERT: insertar nuevo producto
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
        search_vector, calculated_data, 
        in_my_stock, stock_threshold,
        created_at, updated_at
      )
      VALUES (
        p_user_id, p_list_id, v_existing_id,
        v_product->>'code',
        v_product->>'name',
        v_calculated_price,
        v_preserved_quantity,
        to_tsvector('spanish', v_search_text),
        COALESCE(v_calculated_data, '{}'::jsonb),
        COALESCE(v_preserved_in_my_stock, false),
        COALESCE(v_preserved_stock_threshold, 0),
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

  -- Limpieza: eliminar entradas huérfanas en el índice
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
$function$;