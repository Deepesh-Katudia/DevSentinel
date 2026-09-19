import { describe, expect, test } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { isSameSession } from "./session";

function makeSession(accessToken: string, userId: string): Session {
  return {
    access_token: accessToken,
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: userId } as Session["user"],
  } as Session;
}

describe("isSameSession", () => {
  test("treats a re-emitted session with the same token and user as unchanged", () => {
    // Supabase emits a fresh SIGNED_IN object every time the tab regains focus.
    const first = makeSession("token-a", "user-1");
    const reEmitted = makeSession("token-a", "user-1");

    expect(isSameSession(first, reEmitted)).toBe(true);
  });

  test("detects a refreshed access token", () => {
    expect(isSameSession(makeSession("token-a", "user-1"), makeSession("token-b", "user-1"))).toBe(false);
  });

  test("detects a different user", () => {
    expect(isSameSession(makeSession("token-a", "user-1"), makeSession("token-a", "user-2"))).toBe(false);
  });

  test("treats two signed-out states as unchanged", () => {
    expect(isSameSession(null, null)).toBe(true);
  });

  test("detects sign-in and sign-out transitions", () => {
    const session = makeSession("token-a", "user-1");

    expect(isSameSession(null, session)).toBe(false);
    expect(isSameSession(session, null)).toBe(false);
  });
});
