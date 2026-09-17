import { describe, expect, test } from "vitest";
import { GET } from "./route";

describe("GitHub callback", () => {
  test("redirects with a missing_org_state error before linking", async () => {
    const response = await GET({
      url: "https://app.test/api/github/callback?installation_id=123",
    } as never);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/settings/organisation?tab=integrations&error=missing_org_state"
    );
  });
});
