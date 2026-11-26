import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';
import { addDays, addMonths, type LocalDate } from '@/shared/dates';

import type { CheckinSource, CheckinStatus } from '../home/types';

export type HistoryDay = {
  id: string;
  local_date: LocalDate;
  status: CheckinStatus;
  source: CheckinSource;
  note: string | null;
};

/** Your own check-ins for one month ('YYYY-MM'), with your private notes (RLS: author-only). */
export function useHistory(month: string) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['history', uid, month],
    enabled: uid !== null,
    queryFn: async (): Promise<Record<LocalDate, HistoryDay>> => {
      if (!uid) return {};
      const first = `${month}-01`;
      const last = addDays(`${addMonths(month, 1)}-01`, -1);
      const { data: rows, error } = await supabase
        .from('checkins')
        .select('id, local_date, status, source')
        .eq('user_id', uid)
        .gte('local_date', first)
        .lte('local_date', last);
      if (error) throw error;
      const ids = rows.map((r) => r.id);
      const notes: Record<string, string> = {};
      if (ids.length) {
        const { data: noteRows, error: noteError } = await supabase.from('checkin_notes').select('checkin_id, note').in('checkin_id', ids);
        if (noteError) throw noteError;
        for (const n of noteRows) notes[n.checkin_id] = n.note;
      }
      return Object.fromEntries(rows.map((r) => [r.local_date, { ...r, note: notes[r.id] ?? null }]));
    },
  });
}
