import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) { setProfile(null); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // For Google users: sync avatar from OAuth metadata if no profile avatar
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  // Display name: profile username > Google name > email prefix
  const displayName =
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  // Initials for avatar fallback
  const initials = displayName.slice(0, 2).toUpperCase();

  return { profile, loading, avatarUrl, displayName, initials, refetch: fetchProfile };
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase().trim())
    .maybeSingle();
  return !data;
}

export async function createProfile(userId: string, username: string, displayName?: string, avatarUrl?: string) {
  return supabase.from("profiles").insert({
    user_id: userId,
    username: username.toLowerCase().trim(),
    display_name: displayName || null,
    avatar_url: avatarUrl || null,
  });
}
