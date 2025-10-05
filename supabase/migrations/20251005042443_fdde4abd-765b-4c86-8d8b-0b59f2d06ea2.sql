-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create stock_items table
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  category TEXT,
  cost_price DECIMAL(10,2),
  special_discount BOOLEAN DEFAULT false,
  min_stock_limit INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, code)
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create invoice_products table
CREATE TABLE public.invoice_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  cost_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  quantity INTEGER NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.invoice_products ENABLE ROW LEVEL SECURITY;

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create import_records table
CREATE TABLE public.import_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  file_name TEXT,
  import_date DATE,
  new_products INTEGER DEFAULT 0,
  updated_products INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.import_records ENABLE ROW LEVEL SECURITY;

-- Create request_items table
CREATE TABLE public.request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX idx_stock_items_user_id ON public.stock_items(user_id);
CREATE INDEX idx_stock_items_supplier_id ON public.stock_items(supplier_id);
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoice_products_invoice_id ON public.invoice_products(invoice_id);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_request_items_user_id ON public.request_items(user_id);
CREATE INDEX idx_request_items_product_id ON public.request_items(product_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update invoice status based on payments and due date
CREATE OR REPLACE FUNCTION public.update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
BEGIN
  -- Get invoice details
  SELECT total_amount, amount_paid, due_date 
  INTO invoice_record
  FROM public.invoices 
  WHERE id = NEW.invoice_id;
  
  -- Update status based on payment and due date
  IF invoice_record.amount_paid >= invoice_record.total_amount THEN
    UPDATE public.invoices 
    SET status = 'paid' 
    WHERE id = NEW.invoice_id;
  ELSIF invoice_record.due_date < CURRENT_DATE THEN
    UPDATE public.invoices 
    SET status = 'overdue' 
    WHERE id = NEW.invoice_id;
  ELSE
    UPDATE public.invoices 
    SET status = 'pending' 
    WHERE id = NEW.invoice_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update invoice status after payment
CREATE TRIGGER update_invoice_status_on_payment
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_status();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for suppliers
CREATE POLICY "Users can view own suppliers"
  ON public.suppliers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers"
  ON public.suppliers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers"
  ON public.suppliers FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for stock_items
CREATE POLICY "Users can view own stock items"
  ON public.stock_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stock items"
  ON public.stock_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stock items"
  ON public.stock_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stock items"
  ON public.stock_items FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for clients
CREATE POLICY "Users can view own clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for invoices
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for invoice_products
CREATE POLICY "Users can view invoice products"
  ON public.invoice_products FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_products.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert invoice products"
  ON public.invoice_products FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_products.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can update invoice products"
  ON public.invoice_products FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_products.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete invoice products"
  ON public.invoice_products FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_products.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

-- RLS Policies for payments
CREATE POLICY "Users can view payments"
  ON public.payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = payments.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = payments.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can update payments"
  ON public.payments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = payments.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete payments"
  ON public.payments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = payments.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

-- RLS Policies for import_records
CREATE POLICY "Users can view own import records"
  ON public.import_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import records"
  ON public.import_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own import records"
  ON public.import_records FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for request_items
CREATE POLICY "Users can view own request items"
  ON public.request_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own request items"
  ON public.request_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own request items"
  ON public.request_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own request items"
  ON public.request_items FOR DELETE
  USING (auth.uid() = user_id);