-- Create product_lists table to store multiple lists per supplier
CREATE TABLE public.product_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  product_count INTEGER NOT NULL DEFAULT 0,
  column_schema JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Create dynamic_products table to store products with flexible schema
CREATE TABLE public.dynamic_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  list_id UUID NOT NULL REFERENCES public.product_lists(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT,
  price NUMERIC,
  quantity INTEGER,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_products ENABLE ROW LEVEL SECURITY;

-- Create policies for product_lists
CREATE POLICY "Users can view own product lists"
ON public.product_lists FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product lists"
ON public.product_lists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product lists"
ON public.product_lists FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own product lists"
ON public.product_lists FOR DELETE
USING (auth.uid() = user_id);

-- Create policies for dynamic_products
CREATE POLICY "Users can view own dynamic products"
ON public.dynamic_products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dynamic products"
ON public.dynamic_products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dynamic products"
ON public.dynamic_products FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dynamic products"
ON public.dynamic_products FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_product_lists_supplier_id ON public.product_lists(supplier_id);
CREATE INDEX idx_product_lists_user_id ON public.product_lists(user_id);
CREATE INDEX idx_dynamic_products_list_id ON public.dynamic_products(list_id);
CREATE INDEX idx_dynamic_products_user_id ON public.dynamic_products(user_id);
CREATE INDEX idx_dynamic_products_data ON public.dynamic_products USING GIN(data);

-- Create trigger for automatic timestamp updates on product_lists
CREATE TRIGGER update_product_lists_updated_at
BEFORE UPDATE ON public.product_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on dynamic_products
CREATE TRIGGER update_dynamic_products_updated_at
BEFORE UPDATE ON public.dynamic_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();