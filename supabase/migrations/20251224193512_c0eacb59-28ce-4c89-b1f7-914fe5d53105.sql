-- Function to rename a JSONB key in dynamic_products and dynamic_products_index
CREATE OR REPLACE FUNCTION public.rename_jsonb_key_in_products(
  p_list_id uuid,
  p_old_key text,
  p_new_key text
) 
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count integer := 0;
  v_user_id uuid;
BEGIN
  -- Verify user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Skip if keys are the same
  IF p_old_key = p_new_key THEN
    RETURN 0;
  END IF;

  -- Update dynamic_products: move data from old_key to new_key
  UPDATE dynamic_products
  SET 
    data = (data - p_old_key) || jsonb_build_object(p_new_key, data->p_old_key),
    updated_at = now()
  WHERE list_id = p_list_id 
    AND user_id = v_user_id
    AND data ? p_old_key;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update dynamic_products_index calculated_data if it contains the key
  UPDATE dynamic_products_index
  SET 
    calculated_data = (calculated_data - p_old_key) || jsonb_build_object(p_new_key, calculated_data->p_old_key),
    updated_at = now()
  WHERE list_id = p_list_id 
    AND user_id = v_user_id
    AND calculated_data ? p_old_key;
  
  RAISE NOTICE 'Renamed key % to % in % products for list %', p_old_key, p_new_key, v_updated_count, p_list_id;
  
  RETURN v_updated_count;
END;
$$;