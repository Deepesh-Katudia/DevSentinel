export interface PostLoginRoute {
  route: "/dashboard" | "/onboarding";
  orgId?: string;
}

interface PostLoginDeps {
  fetchOrgs: () => Promise<Array<{ id: string }>>;
  fetchInvites: () => Promise<Array<{ id: string }>>;
}

/**
 * Decide where a freshly signed-in user should land.
 *
 * Lookup failures are rethrown rather than treated as "no org": routing an
 * existing member to onboarding (e.g. while the API wakes up) invites them to
 * create a duplicate organisation.
 */
export async function resolvePostLoginRoute({
  fetchOrgs,
  fetchInvites,
}: PostLoginDeps): Promise<PostLoginRoute> {
  const orgs = await fetchOrgs();
  if (orgs.length > 0) return { route: "/dashboard", orgId: orgs[0].id };

  const invites = await fetchInvites();
  return invites.length > 0 ? { route: "/dashboard" } : { route: "/onboarding" };
}
