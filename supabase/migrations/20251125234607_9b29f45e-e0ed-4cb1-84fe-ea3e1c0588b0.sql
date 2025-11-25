-- Crear bucket para PDFs de remitos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-notes-pdf',
  'delivery-notes-pdf',
  true,
  5242880, -- 5MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir subir archivos a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden subir PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery-notes-pdf');

-- Política para permitir actualizar archivos a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden actualizar PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'delivery-notes-pdf');

-- Política para permitir eliminar archivos a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden eliminar PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'delivery-notes-pdf');

-- Política para permitir lectura pública (el bucket es público)
CREATE POLICY "Acceso público de lectura a PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'delivery-notes-pdf');