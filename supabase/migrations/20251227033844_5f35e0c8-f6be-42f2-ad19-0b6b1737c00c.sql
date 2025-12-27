-- Tabla de My Stock con clave primaria y foráneas
create table public.my_stock_products (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid not null references dynamic_products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  quantity numeric not null default 0,
  stock_threshold numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Campos duplicados para rendimiento (actualizados automáticamente)
  code text,
  name text,
  price numeric
);

-- Índices para consultas rápidas por usuario/producto
create unique index my_stock_products_user_product_idx
  on public.my_stock_products (user_id, product_id);

-- Trigger para actualizar los campos duplicados en insert/update
create or replace function update_my_stock_fields()
returns trigger as $$
begin
  select code, name, price
    into new.code, new.name, new.price
  from dynamic_products where id = new.product_id;

  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_update_my_stock_fields
before insert or update on public.my_stock_products
for each row execute procedure update_my_stock_fields();

-- Enable Row Level Security
ALTER TABLE public.my_stock_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own my_stock_products"
ON public.my_stock_products
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own my_stock_products"
ON public.my_stock_products
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own my_stock_products"
ON public.my_stock_products
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own my_stock_products"
ON public.my_stock_products
FOR DELETE
USING (auth.uid() = user_id);