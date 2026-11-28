import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { refreshWidgets } from '@/widget/refresh';

/** Every onboarding/crew mutation refreshes Home (which drives the onboarding gate) and the profile. */
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['home'] }), qc.invalidateQueries({ queryKey: ['profile'] })]);
}

export function useUpdateProfile() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { displayName?: string; avatarId?: string; timezone?: string; reminderTime?: string; autoUseFreeze?: boolean }) => {
      const { data, error } = await supabase.rpc('update_profile', {
        p_display_name: input.displayName,
        p_avatar_id: input.avatarId,
        p_timezone: input.timezone,
        p_reminder_time: input.reminderTime,
        p_auto_use_freeze: input.autoUseFreeze,
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

export function useSetVacation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { start: string; end: string }) => {
      const { data, error } = await supabase.rpc('set_vacation', { p_start: input.start, p_end: input.end });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
}

export function useCancelVacation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('cancel_vacation', { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
}

/** Leave your crew (SPEC §14.12). Clears every cached query (they're all crew-scoped) and the widget. */
export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('leave_group');
      if (error) throw error;
      return data as { group_id: string; group_deleted: boolean };
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      await refreshWidgets().catch(() => undefined);
    },
  });
}
