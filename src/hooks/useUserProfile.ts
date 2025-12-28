import { useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, saveUserProfile, type UserProfile } from "@/lib/userProfile";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUserProfile, updateUserProfileRow, type UserProfileRow } from "@/services/userProfileService";

export function useUserProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user-profile", userId, isOnline ? "online" : "offline"],
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!userId) return null;
      if (isOnline === false) {
        return getUserProfile(userId);
      }
      const remote = await fetchUserProfile(userId);
      saveUserProfile(userId, remote);
      return remote;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!userId) return;
    const handler = (event: Event) => {
      const detailUserId = (event as CustomEvent)?.detail?.userId as string | undefined;
      if (!detailUserId || detailUserId === userId) {
        queryClient.invalidateQueries({ queryKey: ["user-profile", userId] });
      }
    };
    window.addEventListener("userprofile:changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("userprofile:changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [queryClient, userId]);

  const update = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!userId) return null;

      const dbPatch: Partial<UserProfileRow> = {
        company_name: patch.companyName ?? undefined,
        company_logo_url: patch.companyLogoUrl ?? undefined,
        user_name: patch.userName ?? undefined,
        profile_onboarding_done: patch.profileOnboardingDone ?? undefined,
      };

      // Optimistic cache update
      const previous = queryClient.getQueryData<UserProfile | null>(["user-profile", userId, isOnline ? "online" : "offline"]);
      const optimistic: UserProfile = {
        companyName: (patch.companyName ?? previous?.companyName ?? "").trim(),
        companyLogoUrl: patch.companyLogoUrl ?? previous?.companyLogoUrl ?? undefined,
        userName: (patch.userName ?? previous?.userName ?? "").trim() || undefined,
        profileOnboardingDone: patch.profileOnboardingDone ?? previous?.profileOnboardingDone ?? false,
      };
      queryClient.setQueryData(["user-profile", userId, isOnline ? "online" : "offline"], optimistic);
      saveUserProfile(userId, optimistic);

      if (isOnline === false) return optimistic;

      try {
        const remote = await updateUserProfileRow(userId, dbPatch);
        queryClient.setQueryData(["user-profile", userId, "online"], remote);
        saveUserProfile(userId, remote);
        return remote;
      } catch (e) {
        queryClient.setQueryData(["user-profile", userId, isOnline ? "online" : "offline"], previous ?? null);
        if (previous) saveUserProfile(userId, previous);
        throw e;
      }
    },
    [isOnline, queryClient, userId],
  );

  const profile = query.data ?? null;
  const companyName = useMemo(() => profile?.companyName?.trim() || "", [profile?.companyName]);
  const companyLogoUrl = profile?.companyLogoUrl;
  const userName = useMemo(() => profile?.userName?.trim() || "", [profile?.userName]);
  const profileOnboardingDone = profile?.profileOnboardingDone ?? false;

  return {
    userId,
    profile,
    update,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    companyName,
    companyLogoUrl,
    userName,
    profileOnboardingDone,
  };
}
