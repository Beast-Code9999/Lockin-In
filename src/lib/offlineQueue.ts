/**
 * Offline check-in queue (SPEC §12.7). A widget check-in that can't reach the
 * server is stored with its intended local date and retried on the next app open,
 * widget update or push. The server still enforces the window: if it has closed
 * meanwhile, the item is dropped and the rejection kept so the app can explain it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

const QUEUE_KEY = 'offline_checkins';
const REJECTED_KEY = 'offline_checkins_rejected';

export type QueuedCheckin = { date: string; queuedAt: string };
export type RejectedCheckin = QueuedCheckin & { reason: string };

async function read<T>(key: string): Promise<T[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(key)) ?? '[]') as T[];
  } catch {
    return [];
  }
}

export const getQueue = () => read<QueuedCheckin>(QUEUE_KEY);

export async function enqueueCheckin(date: string): Promise<void> {
  const queue = (await getQueue()).filter((q) => q.date !== date);
  queue.push({ date, queuedAt: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** A thrown error that never reached the server (vs. a server-side rule rejection). */
export function isNetworkError(e: unknown): boolean {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  return /network|fetch|timeout|failed to connect|offline/i.test(msg);
}

/** Retry queued check-ins. Returns how many were synced. */
export async function flushQueue(): Promise<number> {
  const queue = await getQueue();
  if (!queue.length) return 0;
  const keep: QueuedCheckin[] = [];
  const rejected = await read<RejectedCheckin>(REJECTED_KEY);
  let synced = 0;
  for (const item of queue) {
    const { error } = await supabase.rpc('check_in', { p_local_date: item.date, p_status: 'clean', p_source: 'widget' });
    if (!error) synced++;
    else if (isNetworkError(error)) keep.push(item);
    else rejected.push({ ...item, reason: error.message });
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(keep));
  await AsyncStorage.setItem(REJECTED_KEY, JSON.stringify(rejected.slice(-5)));
  return synced;
}

/** Rejections the app should explain once (e.g. "that day closed while you were offline"). */
export async function takeRejected(): Promise<RejectedCheckin[]> {
  const items = await read<RejectedCheckin>(REJECTED_KEY);
  if (items.length) await AsyncStorage.removeItem(REJECTED_KEY);
  return items;
}
