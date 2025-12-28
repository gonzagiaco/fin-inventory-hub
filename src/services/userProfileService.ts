import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/lib/userProfile";

export type UserProfileRow = {
  id: string;
  company_name: string | null;
  company_logo_url: string | null;
  user_name: string | null;
  profile_onboarding_done: boolean | null;
};

const PROFILE_LOGOS_BUCKET = "profile-logos";

function mapRowToProfile(row: UserProfileRow | null): UserProfile | null {
  if (!row) return null;
  return {
    companyName: row.company_name ?? "",
    companyLogoUrl: row.company_logo_url ?? undefined,
    userName: row.user_name ?? undefined,
    profileOnboardingDone: row.profile_onboarding_done ?? false,
  };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_name, company_logo_url, user_name, profile_onboarding_done")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (
    mapRowToProfile(data as any) ?? {
      companyName: "",
      profileOnboardingDone: false,
    }
  );
}

export async function updateUserProfileRow(userId: string, patch: Partial<UserProfileRow>): Promise<UserProfile> {
  const compactPatch: Record<string, any> = {};
  Object.entries(patch).forEach(([key, value]) => {
    if (value !== undefined) compactPatch[key] = value;
  });

  // Prefer UPDATE to avoid RLS issues on INSERT/UPSERT.
  const { data, error } = await supabase
    .from("profiles")
    .update(compactPatch)
    .eq("id", userId)
    .select("id, company_name, company_logo_url, user_name, profile_onboarding_done")
    .maybeSingle();

  if (!error && data) {
    return (
      mapRowToProfile(data as any) ?? {
        companyName: "",
        profileOnboardingDone: false,
      }
    );
  }

  // If the profile row doesn't exist, try INSERT (requires RLS INSERT policy).
  const insertPayload: any = { id: userId, ...compactPatch };
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select("id, company_name, company_logo_url, user_name, profile_onboarding_done")
    .single();

  if (insertError) throw insertError;
  return (
    mapRowToProfile(inserted as any) ?? {
      companyName: "",
      profileOnboardingDone: false,
    }
  );
}

function getFileExt(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 6) return fromName;
  const fromType = file.type.split("/").pop()?.toLowerCase();
  return fromType && fromType.length <= 6 ? fromType : "png";
}

export async function uploadProfileLogo(userId: string, file: File): Promise<string> {
  const ext = getFileExt(file);
  const path = `${userId}/logo.${ext}`;

  const { error } = await supabase.storage.from(PROFILE_LOGOS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILE_LOGOS_BUCKET).getPublicUrl(path);

  return publicUrl;
}
