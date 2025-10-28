-- ===================================================================
-- 1. CREAR TABLA dynamic_products_index
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.dynamic_products_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES product_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES dynamic_products(id) ON DELETE CASCADE,
  
  -- Campos extraídos según mapping_config
  code text,
  name text,
  price numeric,
  quantity integer,
  
  -- Vector de búsqueda para full-text search
  search_vector tsvector,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(product_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dpi_list_id ON dynamic_products_index(list_id);
CREATE INDEX IF NOT EXISTS idx_dpi_user_id ON dynamic_products_index(user_id);
CREATE INDEX IF NOT EXISTS idx_dpi_search_vector ON dynamic_products_index USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_dpi_code ON dynamic_products_index(code);
CREATE INDEX IF NOT EXISTS idx_dpi_name ON dynamic_products_index(name);

-- Comentarios
COMMENT ON TABLE dynamic_products_index IS 'Índice de búsqueda para productos dinámicos. Se genera a partir de dynamic_products usando mapping_config.';
COMMENT ON COLUMN dynamic_products_index.search_vector IS 'Vector tsvector para búsqueda full-text con índice GIN';

-- RLS Policies
ALTER TABLE dynamic_products_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own indexed products"
  ON dynamic_products_index FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own indexed products"
  ON dynamic_products_index FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own indexed products"
  ON dynamic_products_index FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own indexed products"
  ON dynamic_products_index FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- 2. CREAR FUNCIÓN search_products
-- ===================================================================
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

-- ===================================================================
-- 3. CREAR TRIGGER PARA SINCRONIZACIÓN AUTOMÁTICA
-- ===================================================================
CREATE OR REPLACE FUNCTION public.sync_index_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar cantidad en el índice si el producto ya existe
  UPDATE dynamic_products_index
  SET 
    quantity = NEW.quantity,
    updated_at = now()
  WHERE product_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_quantity ON dynamic_products;
CREATE TRIGGER trg_sync_quantity
AFTER UPDATE OF quantity ON dynamic_products
FOR EACH ROW
WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity)
EXECUTE FUNCTION sync_index_quantity();

COMMENT ON FUNCTION public.sync_index_quantity IS 'Sincroniza automáticamente la cantidad entre dynamic_products y dynamic_products_index';

-- ===================================================================
-- 4. POBLAR ÍNDICE PARA LISTAS EXISTENTES
-- ===================================================================
DO $$
DECLARE
  list_record RECORD;
  indexed_count integer := 0;
BEGIN
  FOR list_record IN 
    SELECT id, name FROM product_lists WHERE mapping_config IS NOT NULL
  LOOP
    BEGIN
      PERFORM refresh_list_index(list_record.id);
      indexed_count := indexed_count + 1;
      RAISE NOTICE 'Índice refrescado para lista: % (ID: %)', list_record.name, list_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error al refrescar índice para lista % (ID: %): %', list_record.name, list_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Proceso completado. Total de listas indexadas: %', indexed_count;
END $$;