export function getOnboardingStartStep({ hasOrg }: { hasOrg: boolean }): number {
  return hasOrg ? 2 : 1;
}
