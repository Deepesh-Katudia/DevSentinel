import { describe, expect, test } from "vitest";
import { getOnboardingStartStep } from "./onboarding-flow";

describe("getOnboardingStartStep", () => {
  test("starts existing organisations at the GitHub connection step", () => {
    expect(getOnboardingStartStep({ hasOrg: true })).toBe(2);
  });

  test("starts first-time users at organisation creation", () => {
    expect(getOnboardingStartStep({ hasOrg: false })).toBe(1);
  });
});
