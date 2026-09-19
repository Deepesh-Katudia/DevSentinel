import type { Session } from "@supabase/supabase-js";

/**
 * True when two sessions represent the same signed-in state.
 *
 * Supabase re-emits SIGNED_IN with a brand-new Session object every time the
 * tab regains visibility. Comparing by identity would treat each of those as a
 * change and cascade reloads through every consumer, so compare the fields
 * that actually matter: who is signed in and which token they hold.
 */
export function isSameSession(prev: Session | null, next: Session | null): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;
  return prev.access_token === next.access_token && prev.user?.id === next.user?.id;
}
