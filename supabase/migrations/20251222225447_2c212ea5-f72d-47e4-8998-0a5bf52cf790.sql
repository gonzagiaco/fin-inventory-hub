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
  v_custom_columns jsonb;
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
  
  -- Columnas personalizadas
  v_custom_columns := coalesce(v_mapping->'custom_columns', '{}'::jsonb);

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
    -- Calculated data: includes overrides, dollar conversions, AND custom columns
    (
      select coalesce(
        jsonb_object_agg(col_key, col_value) FILTER (WHERE col_value IS NOT NULL),
        '{}'::jsonb
      )
      from (
        -- Override and dollar conversion columns (existing logic)
        select col_key,
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
          end as col_value
        from (
          select distinct col_key
          from (
            select jsonb_object_keys(v_mapping->'price_modifiers'->'overrides') as col_key
            where v_mapping->'price_modifiers'->'overrides' is not null
            union
            select jsonb_array_elements_text(v_dollar_columns) as col_key
          ) combined
          where dp.data ? col_key
        ) override_cols
        
        union all
        
        -- Custom columns calculations
        select 
          custom_key as col_key,
          calculate_price_with_modifiers(
            dp.data->>(v_custom_columns->custom_key->>'base_column'),
            coalesce((v_custom_columns->custom_key->>'percentage')::numeric, 0),
            coalesce((v_custom_columns->custom_key->>'add_vat')::boolean, false),
            coalesce((v_custom_columns->custom_key->>'vat_rate')::numeric, 21)
          ) as col_value
        from jsonb_object_keys(v_custom_columns) as custom_key
        where dp.data ? (v_custom_columns->custom_key->>'base_column')
      ) all_calculated
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

  raise notice 'Índice refrescado para lista %: % productos, % datos preservados, conversión dólar: % (fuente: %), columnas personalizadas: %', 
    p_list_id, 
    (select count(*) from dynamic_products_index where list_id = p_list_id),
    (select count(*) from temp_preserved),
    case when v_dollar_rate > 0 then 'ACTIVA ($' || v_dollar_rate || ')' else 'INACTIVA' end,
    case when v_global_dollar_rate is not null then 'GLOBAL' else 'LOCAL/FALLBACK' end,
    (select count(*) from jsonb_object_keys(v_custom_columns));
end;
$function$;