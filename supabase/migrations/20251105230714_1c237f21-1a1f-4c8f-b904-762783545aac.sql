-- Actualizar función refresh_list_index con normalización robusta de precios,
-- aplicación de descuentos/IVA y redondeo final a 2 decimales
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

    -- CODE: tomar la primera clave presente según el mapping; si no, dp.code
    COALESCE(
      (SELECT (dp.data->>key)::text
       FROM jsonb_array_elements_text(v_mapping->'code_keys') AS key
       WHERE dp.data->>key IS NOT NULL
       LIMIT 1),
      dp.code
    ) AS code,

    -- NAME: tomar la primera clave presente según el mapping; si no, dp.name
    COALESCE(
      (SELECT (dp.data->>key)::text
       FROM jsonb_array_elements_text(v_mapping->'name_keys') AS key
       WHERE dp.data->>key IS NOT NULL
       LIMIT 1),
      dp.name
    ) AS name,

    -- PRICE: normalización inteligente + % (override→general) + IVA, con redondeo final a 2 decimales
    ROUND(
      CASE
        WHEN v_mapping->>'price_primary_key' IS NOT NULL THEN
          (
            -- 1) Normalización robusta del precio crudo tomado desde dp.data->>price_primary_key
            COALESCE(
              (
                WITH raw AS (
                  -- Dejar sólo dígitos, coma, punto y signo (por si hubiera negativos)
                  SELECT REGEXP_REPLACE(dp.data->>(v_mapping->>'price_primary_key'), '[^0-9.,-]', '', 'g') AS t
                ),
                last_sep AS (
                  -- Posición del último '.' y ',' contadas desde el final (en string reverso)
                  SELECT
                    t,
                    NULLIF(STRPOS(REVERSE(t), '.'), 0) AS dot_from_end,
                    NULLIF(STRPOS(REVERSE(t), ','), 0) AS comma_from_end
                  FROM raw
                ),
                pick_sep AS (
                  -- Elegimos el ÚLTIMO separador en el string original:
                  -- en el string reverso, eso es el separador con MENOR índice (más "cerca" del final)
                  SELECT
                    t,
                    CASE
                      WHEN dot_from_end IS NULL AND comma_from_end IS NULL THEN NULL
                      ELSE
                        CASE
                          WHEN dot_from_end IS NULL THEN comma_from_end
                          WHEN comma_from_end IS NULL THEN dot_from_end
                          ELSE LEAST(dot_from_end, comma_from_end)
                        END
                    END AS last_sep_from_end
                  FROM last_sep
                ),
                prep AS (
                  -- Convertir posición desde el final a posición en el original (1-based)
                  SELECT
                    t,
                    CASE
                      WHEN last_sep_from_end IS NULL THEN NULL
                      ELSE LENGTH(t) - last_sep_from_end + 1
                    END AS sep_pos
                  FROM pick_sep
                ),
                cleaned AS (
                  SELECT
                    CASE
                      WHEN sep_pos IS NULL OR sep_pos <= 0 THEN
                        -- Sin separadores: quitar cualquier separador residual (miles) y listo
                        REPLACE(REPLACE(t, '.', ''), ',', '')
                      ELSE
                        -- Hay separador: tomar todo como parte entera/fractional respecto del ÚLTIMO separador
                        -- y eliminar separadores de miles en la parte entera.
                        REPLACE(REPLACE(SUBSTRING(t FROM 1 FOR sep_pos - 1), '.', ''), ',', '')
                        || '.' ||
                        -- Parte fraccionaria: tomar todos los dígitos a la derecha del separador
                        REGEXP_REPLACE(SUBSTRING(t FROM sep_pos + 1), '[^0-9]', '', 'g')
                    END AS unified
                  FROM prep
                )
                SELECT NULLIF(unified, '')::numeric
                FROM cleaned
              ),
              -- Si la celda mapeada está vacía o no parsea, caer a dp.price
              dp.price::numeric
            )
          )
          *
          -- 2) Aplicar porcentaje (override de la columna seleccionada, si existe, si no el general)
          (1 + COALESCE(
                (v_mapping->'price_modifiers'->'overrides'->(v_mapping->>'price_primary_key')->>'percentage')::numeric,
                (v_mapping->'price_modifiers'->'general'->>'percentage')::numeric,
                0
              ) / 100.0)
          *
          -- 3) Aplicar IVA si corresponde (21%)
          CASE WHEN COALESCE(
                 (v_mapping->'price_modifiers'->'overrides'->(v_mapping->>'price_primary_key')->>'add_vat')::boolean,
                 (v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean,
                 FALSE
               )
          THEN 1.21 ELSE 1.0 END

        ELSE
          -- Sin columna de precio mapeada: usar dp.price con el modificador general
          (dp.price)::numeric
          *
          (1 + COALESCE(
                 (v_mapping->'price_modifiers'->'general'->>'percentage')::numeric,
                 0
               ) / 100.0)
          *
          CASE WHEN COALESCE(
                 (v_mapping->'price_modifiers'->'general'->>'add_vat')::boolean,
                 FALSE
               )
          THEN 1.21 ELSE 1.0 END
      END
    , 2) AS price,

    -- QUANTITY: según quantity_key si está mapeada; si no, dp.quantity
    CASE
      WHEN v_mapping->>'quantity_key' IS NOT NULL
      THEN (dp.data->>(v_mapping->>'quantity_key'))::integer
      ELSE dp.quantity
    END AS quantity,

    -- SEARCH VECTOR: concatenación de code/name/extra_index_keys + code/name “base”
    to_tsvector('spanish',
      COALESCE(
        (SELECT string_agg(dp.data->>key, ' ')
         FROM jsonb_array_elements_text(
           (COALESCE(v_mapping->'code_keys', '[]'::jsonb))
           || (COALESCE(v_mapping->'name_keys', '[]'::jsonb))
           || (COALESCE(v_mapping->'extra_index_keys', '[]'::jsonb))
         ) AS key
         WHERE dp.data->>key IS NOT NULL),
        ''
      )
      || ' ' || COALESCE(dp.code, '')
      || ' ' || COALESCE(dp.name, '')
    ) AS search_vector

  FROM dynamic_products dp
  WHERE dp.list_id = p_list_id;

  RAISE NOTICE 'Índice refrescado para lista %: % productos indexados',
    p_list_id,
    (SELECT COUNT(*) FROM dynamic_products_index WHERE list_id = p_list_id);
END;
$function$;
