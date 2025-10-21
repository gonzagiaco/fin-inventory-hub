-- Add extras column to stock_items for dynamic fields
ALTER TABLE public.stock_items 
ADD COLUMN extras JSONB DEFAULT '{}'::jsonb;

-- Add index for better performance on extras queries
CREATE INDEX idx_stock_items_extras ON public.stock_items USING GIN (extras);

-- Add comment to explain the column
COMMENT ON COLUMN public.stock_items.extras IS 'Stores additional dynamic fields from imported Excel files that do not match standard columns';