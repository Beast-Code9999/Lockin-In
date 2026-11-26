import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** Every onboarding/crew mutation refreshes Home (which drives the onboarding gate) and the profile. */
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['home'] }), qc.invalidateQueries({ queryKey: ['profile'] })]);
}

export function useUpdateProfile() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { displayName?: string; avatarId?: string; timezone?: string; reminderTime?: string }) => {
      const { data, error } = await supabase.rpc('update_profile', {
        p_display_name: input.displayName,
        p_avatar_id: input.avatarId,
        p_timezone: input.timezone,
        p_reminder_time: input.reminderTime,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
}

export function useCreateGroup() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { name: string; timezone: string }) => {
      const { data, error } = await supabase.rpc('create_group', { p_name: input.name, p_timezone: input.timezone });
      if (error) throw error;
      return data as { group_id: string; name: string; invite_code: string };
    },
    onSuccess: refresh,
  });
}

export function useJoinGroup() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_group', { p_invite_code: code });
      if (error) throw error;
      return data as { group_id: string; name: string; invite_code: string };
    },
    onSuccess: refresh,
  });
}

export function useAcceptPact() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('accept_pact');
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
