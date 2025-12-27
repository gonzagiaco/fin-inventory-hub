-- Fix search_path for update_my_stock_fields function
CREATE OR REPLACE FUNCTION public.update_my_stock_fields()
RETURNS trigger AS $$
BEGIN
  SELECT code, name, price
    INTO new.code, new.name, new.price
  FROM public.dynamic_products WHERE id = new.product_id;

  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;