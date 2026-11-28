/**
 * Headless widget task handler (SPEC §12.6–12.7). Registered in index.ts, so it runs
 * even when the app is closed. Never logs a slip — only clean check-ins, with a
 * two-step confirm.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { enqueueCheckin, isNetworkError } from '@/lib/offlineQueue';
import { supabase } from '@/lib/supabase';
import { CONFIG } from '@/shared/constants';

import { refreshSnapshot, updateWidgets } from './refresh';
import { renderWidgetFor } from './render';
import { loadLocalState, patchLocalState } from './state';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkIn(date: string): Promise<void> {
  await patchLocalState({ inFlight: true, pendingConfirmUntil: null });
  await updateWidgets();
  const { data, error } = await supabase.rpc('check_in', { p_local_date: date, p_status: 'clean', p_source: 'widget' });
  if (!error) {
    const points = (data as { points?: number } | null)?.points ?? null;
    await patchLocalState({ inFlight: false, justGained: points, queuedDate: null });
    await refreshSnapshot();
  } else if (isNetworkError(error)) {
    await enqueueCheckin(date);
    await patchLocalState({ inFlight: false, queuedDate: date });
  } else {
    // A rule said no (e.g. it's before 5pm or the day closed): just show the real state.
    await patchLocalState({ inFlight: false });
    await refreshSnapshot();
  }
  await updateWidgets();
}

async function onCheckInTap(date: string): Promise<void> {
  const local = await loadLocalState();
  const armed = local.pendingConfirmUntil !== null && Date.parse(local.pendingConfirmUntil) > Date.now();
  if (armed) return checkIn(date);

  // First tap: arm the confirm step, then revert after WIDGET_CONFIRM_SECONDS.
  const until = new Date(Date.now() + CONFIG.WIDGET_CONFIRM_SECONDS * 1000).toISOString();
  await patchLocalState({ pendingConfirmUntil: until });
  await updateWidgets();
  await sleep(CONFIG.WIDGET_CONFIRM_SECONDS * 1000 + 300);
  const after = await loadLocalState();
  if (after.pendingConfirmUntil === until) {
    await patchLocalState({ pendingConfirmUntil: null });
    await updateWidgets();
  }
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_RESIZED':
    case 'WIDGET_UPDATE':
      // Render from cache immediately, then refresh and render again.
      renderWidget(await renderWidgetFor(widgetInfo));
      if (await refreshSnapshot()) {
        await patchLocalState({ justGained: null });
        renderWidget(await renderWidgetFor(widgetInfo));
      }
      break;
    case 'WIDGET_CLICK':
      if (clickAction === 'CHECK_IN' && typeof clickActionData?.date === 'string') await onCheckInTap(clickActionData.date);
      break;
    default:
      break;
  }
}
