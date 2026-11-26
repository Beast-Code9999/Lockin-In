import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
});

/** Refetch stale queries when the app returns to the foreground. Returns an unsubscribe. */
export function wireQueryFocus(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  return () => sub.remove();
}
