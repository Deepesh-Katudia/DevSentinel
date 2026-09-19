/**
 * True when Supabase's public auth settings (GET /auth/v1/settings) report the
 * OAuth provider as enabled. Anything unexpected counts as disabled, so the UI
 * never offers a button that dead-ends on "provider is not enabled".
 */
export function isOAuthProviderEnabled(settings: unknown, provider: string): boolean {
  if (!settings || typeof settings !== "object") return false;
  const external = (settings as { external?: unknown }).external;
  if (!external || typeof external !== "object") return false;
  return (external as Record<string, unknown>)[provider] === true;
}
