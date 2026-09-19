import { describe, expect, test } from "vitest";
import { getNextStep, getOnboardingStartStep, getPreviousStep } from "./onboarding-flow";
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

describe("step navigation", () => {
  test("advances from the step on screen, not a stale lower counter", () => {
    // With an org, the page shows step 2 while the raw counter is still 1;
    // incrementing the counter left the user stuck on step 2.
    expect(getNextStep({ activeStep: 2, totalSteps: 4 })).toBe(3);
  });

  test("does not advance past the last step", () => {
    expect(getNextStep({ activeStep: 4, totalSteps: 4 })).toBe(4);
  });

  test("goes back from the step on screen but never below the minimum", () => {
    expect(getPreviousStep({ activeStep: 4, minimumStep: 2 })).toBe(3);
    expect(getPreviousStep({ activeStep: 2, minimumStep: 2 })).toBe(2);
  });
});
