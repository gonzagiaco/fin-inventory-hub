-- Add new columns to profiles table for user configuration
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS company_logo_url text,
ADD COLUMN IF NOT EXISTS user_name text,
ADD COLUMN IF NOT EXISTS profile_onboarding_done boolean NOT NULL DEFAULT false;

-- Create trigger for updated_at if it doesn't exist
-- (using existing update_updated_at_column function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_profiles_updated_at' 
    AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Verify existing RLS policies cover new columns (they do, since they use auth.uid() = id)
-- No changes needed to existing policies as they already allow SELECT/UPDATE on own profile