/**
 * Widget snapshot (SPEC §12.5). The widget never queries Supabase while rendering:
 * it renders this cached JSON. The server builds it (`get_widget_snapshot`); the
 * client only adds avatar layer keys and XP (pure mirrors) before caching.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { resolveAvatarLayers } from '@/shared/avatar';
import type { FlameTier } from '@/shared/ranks';
import { rankKeyFromLabel, xpProgress } from '@/shared/ranks';

export type TodayStatus = 'checked' | 'pending' | 'box' | 'coward' | 'clown' | 'vacation' | 'frozen';

export type WidgetMember = {
  uid: string;
  name: string;
  avatarLayers: string[];
  score30d: number;
  seasonPoints: number;
  streak: number;
  flameTier: FlameTier;
  rank: string;
  xp: { current: number; next: number | null };
  todayStatus: TodayStatus;
  position: number;
};

export type WidgetSnapshot = {
  version: 1;
  generatedAt: string;
  me: {
    uid: string;
    timezone: string;
    todayLocal: string;
    localTime: string;
    checkinOpensAt: string;
    inGame: boolean;
    checkedInToday: boolean;
    yesterdayPending: boolean;
    owedBoxId: string | null;
  };
  season: { number: number; endsOn: string; daysLeft: number } | null;
  members: WidgetMember[];
  rival: { text: string } | null;
  activeSos: { id: string; uid: string; name: string; endsAt: string } | null;
  lastEvent: { text: string; at: string } | null;
};

export const SNAPSHOT_KEY = 'widget_snapshot_v1';

/** Raw member shape from the RPC (before client-side enrichment). */
type RawMember = Omit<WidgetMember, 'avatarLayers' | 'xp'> & { avatarId: string };
type RawSnapshot = Omit<WidgetSnapshot, 'members' | 'me'> & { me: Omit<WidgetSnapshot['me'], 'timezone'>; members: RawMember[] };

/** Status → avatar state overlay (shame states only ever come from missed days / failed forfeits). */
export function enrichSnapshot(raw: RawSnapshot, timezone: string): WidgetSnapshot {
  return {
    ...raw,
    me: { ...raw.me, timezone },
    members: raw.members.map(({ avatarId, ...m }) => ({
      ...m,
      avatarLayers: resolveAvatarLayers({
        avatarId,
        rank: rankKeyFromLabel(m.rank),
        owesBox: m.todayStatus === 'box',
        cowardUntil: m.todayStatus === 'coward' ? '9999-01-01T00:00:00Z' : null,
        clownUntil: m.todayStatus === 'clown' ? '9999-01-01T00:00:00Z' : null,
      }),
      xp: xpProgress(m.streak),
    })),
  };
}

export async function fetchSnapshot(): Promise<WidgetSnapshot | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const [{ data, error }, profile] = await Promise.all([
    supabase.rpc('get_widget_snapshot'),
    supabase.from('profiles').select('timezone').eq('id', session.session.user.id).single(),
  ]);
  if (error) throw error;
  // The RPC returns jsonb (typed as Json); its shape is defined by app.get_widget_snapshot_impl.
  return enrichSnapshot(data as unknown as RawSnapshot, profile.data?.timezone ?? 'Australia/Darwin');
}

export async function loadCachedSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: WidgetSnapshot | null): Promise<void> {
  if (snapshot) await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  else await AsyncStorage.removeItem(SNAPSHOT_KEY);
}
