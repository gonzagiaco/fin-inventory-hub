export type UserProfile = {
  companyName: string;
  companyLogoUrl?: string;
  userName?: string;
  profileOnboardingDone?: boolean;
};

const PROFILE_KEY_PREFIX = "inspira_user_profile_v1:";

export function getUserProfileStorageKey(userId: string) {
  return `${PROFILE_KEY_PREFIX}${userId}`;
}

export function getUserProfile(userId: string | null | undefined): UserProfile | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getUserProfileStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveUserProfile(userId: string, profile: UserProfile): void {
  localStorage.setItem(getUserProfileStorageKey(userId), JSON.stringify(profile));
  try {
    window.dispatchEvent(new CustomEvent("userprofile:changed", { detail: { userId } }));
  } catch {}
}

export function updateUserProfile(userId: string, patch: Partial<UserProfile>): UserProfile {
  const current = getUserProfile(userId) ?? { companyName: "" };
  const next: UserProfile = {
    ...current,
    ...patch,
    companyName: (patch.companyName ?? current.companyName ?? "").trim(),
    userName: (patch.userName ?? current.userName ?? "").trim() || undefined,
  };
  saveUserProfile(userId, next);
  return next;
}

export function getCompanyNameForDocs(userId: string | null | undefined): string {
  const profile = getUserProfile(userId);
  return profile?.companyName?.trim() || profile?.userName?.trim() || "InspiraStock";
}
