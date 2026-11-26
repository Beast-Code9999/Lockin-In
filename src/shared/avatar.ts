/**
 * Avatar layering (SPEC §8.3). Pure — used by the app and the home-screen widget.
 *
 * An avatar is a stack of pre-rendered pixel layers (see assets/pixel/manifest.json):
 *   1. rank backdrop   avatar/rank/<rank>   the "bubble" that upgrades with your rank
 *   2. base character  avatar/base/<id>     picked at onboarding
 *   3. state overlay   avatar/state/<state> jail > chicken > clown > shield (optional)
 */
import type { RankKey } from './ranks';

export const AVATAR_IDS = ['blaze', 'frost', 'volt', 'shade', 'sprout', 'nova', 'ace', 'ghost'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export const DEFAULT_AVATAR_ID: AvatarId = 'blaze';

export type AvatarState = 'jail' | 'chicken' | 'clown' | 'shield';

export type AvatarInputs = {
  avatarId: string;
  rank: RankKey;
  /** Owes an unopened Mystery Box. */
  owesBox?: boolean;
  /** ISO timestamp; chicken costume while in the future (failed forfeit). */
  cowardUntil?: string | null;
  /** ISO timestamp; clown nose + wig while in the future (missed check-in). */
  clownUntil?: string | null;
  /** Active SOS that's going well (optional polish). */
  shield?: boolean;
};

export function isAvatarId(id: string): id is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(id);
}

const isFuture = (iso: string | null | undefined, now: Date) => !!iso && new Date(iso).getTime() > now.getTime();

/** Shame states only ever come from missed check-ins / failed forfeits — never from an honest slip. */
export function avatarState(inputs: AvatarInputs, now: Date = new Date()): AvatarState | null {
  if (inputs.owesBox) return 'jail';
  if (isFuture(inputs.cowardUntil, now)) return 'chicken';
  if (isFuture(inputs.clownUntil, now)) return 'clown';
  if (inputs.shield) return 'shield';
  return null;
}

export function resolveAvatarLayers(inputs: AvatarInputs, now: Date = new Date()): string[] {
  const base = isAvatarId(inputs.avatarId) ? inputs.avatarId : DEFAULT_AVATAR_ID;
  const layers = [`avatar/rank/${inputs.rank}`, `avatar/base/${base}`];
  const state = avatarState(inputs, now);
  if (state) layers.push(`avatar/state/${state}`);
  return layers;
}
