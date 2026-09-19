import { describe, expect, test } from "vitest";
import { GET } from "./route";

describe("GitHub callback", () => {
  test("redirects with a missing_org_state error before linking", async () => {
    const response = await GET({
      url: "https://app.test/api/github/callback?installation_id=123",
    } as never);

    expect(response.headers.get("location")).toBe(
      "https://app.test/settings/organisation?tab=integrations&error=missing_org_state"
    );
  });

  test("redirects back to the host GitHub sent the user to, not a hardcoded fallback", async () => {
    // With NEXT_PUBLIC_APP_URL unset on the deployment, users were sent to localhost:3000.
    const response = await GET({
      url: "https://devsentinel-flame.vercel.app/api/github/callback",
    } as never);

    expect(response.headers.get("location")).toBe(
      "https://devsentinel-flame.vercel.app/settings/organisation?tab=integrations&error=missing_installation_id"
    );
  });
});
