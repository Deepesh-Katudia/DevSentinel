import { describe, expect, test } from "vitest";
import { isOAuthProviderEnabled } from "./auth-providers";

describe("isOAuthProviderEnabled", () => {
  test("is true when Supabase reports the provider as enabled", () => {
    expect(isOAuthProviderEnabled({ external: { google: true, email: true } }, "google")).toBe(true);
  });

  test("is false when the provider is disabled (clicking it shows a raw Supabase error)", () => {
    expect(isOAuthProviderEnabled({ external: { google: false, email: true } }, "google")).toBe(false);
  });

  test("is false for malformed or missing settings", () => {
    expect(isOAuthProviderEnabled(null, "google")).toBe(false);
    expect(isOAuthProviderEnabled({}, "google")).toBe(false);
    expect(isOAuthProviderEnabled({ external: { google: "yes" } }, "google")).toBe(false);
  });
});
