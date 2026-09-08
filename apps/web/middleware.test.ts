import { describe, expect, test } from "vitest";
import { middleware } from "./middleware";

function makeRequest(pathname: string) {
  const url = new URL(`https://devsentinel-flame.vercel.app${pathname}`);
  return {
    nextUrl: {
      pathname,
      clone: () => new URL(url),
    },
    cookies: {
      getAll: () => [],
    },
  };
}

describe("middleware", () => {
  test("lets the auth smoke signup API handle its own secret gate", async () => {
    const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      const response = await middleware(
        makeRequest("/api/auth/smoke-signup") as never
      );

      expect(response.headers.get("location")).toBeNull();
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  });
});
