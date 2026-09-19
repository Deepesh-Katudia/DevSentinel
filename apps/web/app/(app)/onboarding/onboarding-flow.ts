export function getOnboardingStartStep({ hasOrg }: { hasOrg: boolean }): number {
  return hasOrg ? 2 : 1;
}

// Navigation moves from the step on screen (activeStep), which can sit above
// the raw counter when an existing org skips step 1.
export function getNextStep({ activeStep, totalSteps }: { activeStep: number; totalSteps: number }): number {
  return Math.min(activeStep + 1, totalSteps);
}

export function getPreviousStep({ activeStep, minimumStep }: { activeStep: number; minimumStep: number }): number {
  return Math.max(activeStep - 1, minimumStep);
}
