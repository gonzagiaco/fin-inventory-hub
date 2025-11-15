-- Actualizar función refresh_list_index para usar dólar global desde settings
create or replace function public.refresh_list_index(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- Columnas donde aplicar (siempre desde mapping_config)
  v_dollar_columns := coalesce(v_mapping->'dollar_conversion'->'target_columns', '[]'::jsonb);

  -- PASO 1: Guardar cantidades actuales (editadas manualmente)
  create temp table if not exists temp_quantities (
    product_id uuid primary key,
    quantity integer
  ) on commit drop;
  
  truncate temp_quantities;
  
  insert into temp_quantities (product_id, quantity)
  select product_id, quantity 
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
    calculated_data
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
    -- QUANTITY (temporal, del archivo)
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
    -- Calculated data: TODAS las columnas en target_columns
    (
      select jsonb_object_agg(
        col_key,
        case 
          -- Si la columna tiene override configurado, aplicar modificadores + conversión
          when v_mapping->'price_modifiers'->'overrides' ? col_key then
            apply_dollar_conversion(
              calculate_price_with_modifiers(
                dp.data->>col_key,
                (v_mapping->'price_modifiers'->'overrides'->col_key->>'percentage')::numeric,
                (v_mapping->'price_modifiers'->'overrides'->col_key->>'add_vat')::boolean,
                coalesce(
                  (v_mapping->'price_modifiers'->'overrides'->col_key->>'vat_rate')::numeric,
                  (v_mapping->'price_modifiers'->'general'->>'vat_rate')::numeric,
                  21
                )
              ),
              case when v_dollar_rate > 0 then v_dollar_rate else 0 end
            )
          -- Si NO tiene override pero está en target_columns, solo conversión
          else
            apply_dollar_conversion(
              parse_price_string(dp.data->>col_key),
              case when v_dollar_rate > 0 then v_dollar_rate else 0 end
            )
        end
      )
      from jsonb_array_elements_text(v_dollar_columns) as col_key
      where dp.data ? col_key
    ) as calculated_data
  from dynamic_products dp
  where dp.list_id = p_list_id;

  -- PASO 4: RESTAURAR cantidades editadas (CRÍTICO)
  update dynamic_products_index dpi
  set quantity = tq.quantity
  from temp_quantities tq
  where dpi.product_id = tq.product_id
    and dpi.list_id = p_list_id;

  raise notice 'Índice refrescado para lista %: % productos, % cantidades preservadas, conversión dólar: % (fuente: %)', 
    p_list_id, 
    (select count(*) from dynamic_products_index where list_id = p_list_id),
    (select count(*) from temp_quantities),
    case when v_dollar_rate > 0 then 'ACTIVA ($' || v_dollar_rate || ')' else 'INACTIVA' end,
    case when v_global_dollar_rate is not null then 'GLOBAL' else 'LOCAL/FALLBACK' end;
end;
$function$;