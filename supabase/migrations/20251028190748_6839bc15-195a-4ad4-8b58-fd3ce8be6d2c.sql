-- Agregar columna mapping_config a product_lists
ALTER TABLE public.product_lists 
ADD COLUMN IF NOT EXISTS mapping_config jsonb DEFAULT NULL;

COMMENT ON COLUMN public.product_lists.mapping_config IS 
'Configuración de mapeo de columnas para indexación de productos. Estructura: { code_keys: string[], name_keys: string[], quantity_key: string | null, price_primary_key: string | null, price_alt_keys: string[], extra_index_keys: string[] }';