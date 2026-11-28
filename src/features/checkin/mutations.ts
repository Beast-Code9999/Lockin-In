import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { LocalDate } from '@/shared/dates';
import { refreshWidgets } from '@/widget/refresh';

import type { CheckinStatus } from '../home/types';

function useRefreshAfterCheckin() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['home'] }), qc.invalidateQueries({ queryKey: ['history'] }), refreshWidgets().catch(() => undefined)]);
}

export function useCheckIn() {
  const refresh = useRefreshAfterCheckin();
  return useMutation({
    mutationFn: async (input: { date: LocalDate; status: Extract<CheckinStatus, 'clean' | 'relapse'>; note?: string }) => {
      const { data, error } = await supabase.rpc('check_in', {
        p_local_date: input.date,
        p_status: input.status,
        p_note: input.note,
        p_source: 'app',
      });
      if (error) throw error;
      return data;
    },
    onSettled: refresh,
  });
}

export function useUndoSlip() {
  const refresh = useRefreshAfterCheckin();
  return useMutation({
    mutationFn: async (date: LocalDate) => {
      const { data, error } = await supabase.rpc('undo_slip', { p_local_date: date });
      if (error) throw error;
      return data;
    },
    onSettled: refresh,
  });
}
