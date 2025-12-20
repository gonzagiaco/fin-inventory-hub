-- Add stock_threshold column to dynamic_products_index
-- This replaces the global low_stock_threshold with per-product thresholds

ALTER TABLE public.dynamic_products_index 
ADD COLUMN IF NOT EXISTS stock_threshold integer NOT NULL DEFAULT 0;

-- Add an index for filtering low stock products efficiently
CREATE INDEX IF NOT EXISTS idx_dynamic_products_index_stock_threshold 
ON public.dynamic_products_index(stock_threshold);

-- Create a combined index for efficient low stock queries
CREATE INDEX IF NOT EXISTS idx_dynamic_products_index_low_stock 
ON public.dynamic_products_index(in_my_stock, quantity, stock_threshold) 
WHERE in_my_stock = true;

COMMENT ON COLUMN public.dynamic_products_index.stock_threshold IS 'Per-product low stock threshold. Product is low stock when quantity < stock_threshold.';