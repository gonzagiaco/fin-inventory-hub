-- Crear tabla para configuraciones globales del sistema (dólar oficial, etc)
create table public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

-- Habilitar RLS
alter table public.settings enable row level security;

-- Policy: Todos los usuarios autenticados pueden leer
create policy "Anyone authenticated can read settings"
  on public.settings
  for select
  to authenticated
  using (true);

-- NO policies para insert/update/delete desde frontend
-- Solo edge functions con service_role_key pueden escribir

-- Insertar valor inicial del dólar (se actualizará con el cron)
insert into public.settings (key, value, updated_at)
values ('dollar_official', '{"rate": 0, "source": "pending", "fechaActualizacion": null}'::jsonb, now())
on conflict (key) do nothing;

-- Índice para búsquedas rápidas
create index idx_settings_key on public.settings(key);

-- Comentarios
comment on table public.settings is 'Configuraciones globales del sistema';
comment on column public.settings.key is 'Identificador único de la configuración';
comment on column public.settings.value is 'Valor en formato JSON flexible';
comment on column public.settings.updated_at is 'Última actualización del valor';