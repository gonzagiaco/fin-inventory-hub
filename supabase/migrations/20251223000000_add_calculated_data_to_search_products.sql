CREATE OR REPLACE FUNCTION public.search_products(
  p_term text DEFAULT '',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_list_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  list_id uuid,
  code text,
  name text,
  price numeric,
  quantity integer,
  calculated_data jsonb,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dpi.product_id,
    dpi.list_id,
    dpi.code,
    dpi.name,
    dpi.price,
    dpi.quantity,
    dpi.calculated_data,
    CASE 
      WHEN p_term = '' THEN 0::real
      ELSE ts_rank(dpi.search_vector, plainto_tsquery('spanish', p_term))
    END AS rank
  FROM dynamic_products_index dpi
  INNER JOIN product_lists pl ON dpi.list_id = pl.id
  WHERE dpi.user_id = auth.uid()
    AND (p_list_id IS NULL OR dpi.list_id = p_list_id)
    AND (p_supplier_id IS NULL OR pl.supplier_id = p_supplier_id)
    AND (
      p_term = '' OR
      dpi.search_vector @@ plainto_tsquery('spanish', p_term) OR
      dpi.code ILIKE '%' || p_term || '%' OR
      dpi.name ILIKE '%' || p_term || '%'
    )
  ORDER BY 
    CASE WHEN p_term = '' THEN 0 ELSE rank END DESC,
    dpi.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products TO authenticated;

COMMENT ON FUNCTION public.search_products IS 'Búsqueda full-text de productos indexados con soporte para filtros por lista y proveedor';
