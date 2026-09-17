import { describe, expect, test } from "vitest";
import { getOnboardingStartStep } from "./onboarding-flow";
import { buildGithubAppInstallUrl } from "@/lib/github-install";

describe("getOnboardingStartStep", () => {
  test("starts existing organisations at the GitHub connection step", () => {
    expect(getOnboardingStartStep({ hasOrg: true })).toBe(2);
  });

  test("starts first-time users at organisation creation", () => {
    expect(getOnboardingStartStep({ hasOrg: false })).toBe(1);
  });

  test("builds GitHub install URLs with org state", () => {
    expect(buildGithubAppInstallUrl("devsentinel-test", "org-123")).toBe(
      "https://github.com/apps/devsentinel-test/installations/new?state=org-123"
    );
  });

  test("rejects GitHub install URLs without org state", () => {
    expect(() => buildGithubAppInstallUrl("devsentinel-test", "")).toThrow(
      "organisation id"
    );
  });
});
