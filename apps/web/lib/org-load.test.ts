import { describe, expect, test } from "vitest";
import { getOrgLoadAction } from "./org-load";

describe("getOrgLoadAction", () => {
  test("waits while auth is still restoring the session", () => {
    // On a hard reload the session is briefly null before Supabase restores it.
    // Treating that as "signed out" made OrgGuard redirect to /onboarding.
    expect(getOrgLoadAction({ isAuthLoading: true, hasToken: false })).toBe("wait");
  });

  test("fetches orgs once auth has resolved with a token", () => {
    expect(getOrgLoadAction({ isAuthLoading: false, hasToken: true })).toBe("fetch");
  });

  test("reports no session once auth has resolved without a token", () => {
    expect(getOrgLoadAction({ isAuthLoading: false, hasToken: false })).toBe("no-session");
  });
});
