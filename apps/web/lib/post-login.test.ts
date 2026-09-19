import { describe, expect, test, vi } from "vitest";
import { resolvePostLoginRoute } from "./post-login";

const org = { id: "org-1" };

describe("resolvePostLoginRoute", () => {
  test("sends members of an org to the dashboard with that org selected", async () => {
    const result = await resolvePostLoginRoute({
      fetchOrgs: async () => [org],
      fetchInvites: vi.fn(),
    });

    expect(result).toEqual({ route: "/dashboard", orgId: "org-1" });
  });

  test("sends users with a pending invite to the dashboard to accept it", async () => {
    const result = await resolvePostLoginRoute({
      fetchOrgs: async () => [],
      fetchInvites: async () => [{ id: "invite-1" }],
    });

    expect(result).toEqual({ route: "/dashboard" });
  });

  test("sends users with no org and no invites to onboarding", async () => {
    const result = await resolvePostLoginRoute({
      fetchOrgs: async () => [],
      fetchInvites: async () => [],
    });

    expect(result).toEqual({ route: "/onboarding" });
  });

  test("surfaces an org lookup failure instead of routing an existing user to onboarding", async () => {
    // e.g. the API is waking up: onboarding would invite a duplicate org.
    await expect(
      resolvePostLoginRoute({
        fetchOrgs: async () => {
          throw new Error("Failed to fetch");
        },
        fetchInvites: vi.fn(),
      })
    ).rejects.toThrow("Failed to fetch");
  });

  test("surfaces an invite lookup failure too", async () => {
    await expect(
      resolvePostLoginRoute({
        fetchOrgs: async () => [],
        fetchInvites: async () => {
          throw new Error("HTTP 503");
        },
      })
    ).rejects.toThrow("HTTP 503");
  });
});
