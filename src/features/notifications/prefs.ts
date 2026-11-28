/**
 * Notification preferences (SPEC §13): every category can be switched off except SOS,
 * which can only be muted in Android's own settings.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type NotifyCategory = 'reminders' | 'group' | 'boxes' | 'friend_checkins';
export type NotifyPrefs = Record<NotifyCategory, boolean>;
export type NotifySettings = { prefs: NotifyPrefs; reminder_time: string };

export const NOTIFY_CATEGORIES: readonly NotifyCategory[] = ['reminders', 'group', 'boxes', 'friend_checkins'];

const KEY = ['notifyPrefs'] as const;

export function useNotifyPrefs() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_notify_prefs');
      if (error) throw error;
      return data as unknown as NotifySettings; // jsonb RPC result; shape fixed by public.get_notify_prefs()
    },
  });
}

/** Optimistic toggle: flips immediately, rolls back if the server says no. */
export function useSetNotifyPref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ category, on }: { category: NotifyCategory; on: boolean }) => {
      const { error } = await supabase.rpc('set_notify_prefs', { p_prefs: { [category]: on } });
      if (error) throw error;
    },
    onMutate: async ({ category, on }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<NotifySettings>(KEY);
      if (before) qc.setQueryData<NotifySettings>(KEY, { ...before, prefs: { ...before.prefs, [category]: on } });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(KEY, ctx.before);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetReminderTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (time: string) => {
      const { error } = await supabase.rpc('update_profile', { p_reminder_time: time });
      if (error) throw error;
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: ['home'] })]),
  });
}
