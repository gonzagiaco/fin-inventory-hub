-- Corregir warning de seguridad: agregar search_path a parse_price_string
CREATE OR REPLACE FUNCTION parse_price_string(input text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  str text;
  is_negative boolean;
  last_comma int;
  last_dot int;
  result numeric;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN NULL;
  END IF;
  
  str := TRIM(input);
  -- Eliminar símbolos no numéricos salvo coma y punto
  str := REGEXP_REPLACE(str, '[^0-9.,-]', '', 'g');
  
  IF str = '' THEN
    RETURN NULL;
  END IF;
  
  -- Manejar signos negativos
  is_negative := str LIKE '-%';
  IF is_negative THEN
    str := SUBSTRING(str FROM 2);
  END IF;
  
  last_comma := LENGTH(str) - LENGTH(REPLACE(str, ',', ''));
  last_dot := LENGTH(str) - LENGTH(REPLACE(str, '.', ''));
  
  -- Tiene coma y punto: decidir cuál es decimal según la posición
  IF last_comma > 0 AND last_dot > 0 THEN
    IF POSITION(',' IN REVERSE(str)) < POSITION('.' IN REVERSE(str)) THEN
      -- La coma está después del punto: formato "1.234,56"
      str := REPLACE(str, '.', '');
      str := REPLACE(str, ',', '.');
    ELSE
      -- El punto está después de la coma: formato "1,234.56"
      str := REPLACE(str, ',', '');
    END IF;
  ELSIF last_comma > 0 THEN
    -- Solo coma presente -> asumir coma decimal
    str := REPLACE(str, ',', '.');
  END IF;
  
  result := str::numeric;
  
  IF is_negative THEN
    result := -result;
  END IF;
  
  RETURN ROUND(result, 2);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;