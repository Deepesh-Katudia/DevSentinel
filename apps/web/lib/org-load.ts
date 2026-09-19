export type OrgLoadAction = "wait" | "fetch" | "no-session";

/**
 * Decide what OrgProvider should do for the current auth state.
 *
 * A null session only means "signed out" once auth has finished restoring it;
 * before that it is just "not loaded yet" and the org must stay in loading.
 */
export function getOrgLoadAction({
  isAuthLoading,
  hasToken,
}: {
  isAuthLoading: boolean;
  hasToken: boolean;
}): OrgLoadAction {
  if (isAuthLoading) return "wait";
  return hasToken ? "fetch" : "no-session";
}
