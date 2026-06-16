/**
 * Password strength validation — pure, dependency-free, and unit-testable.
 *
 * Rule: at least 8 characters with lowercase, uppercase, and a number.
 * The score (0-4) also rewards length and symbols for the strength meter.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export interface PasswordResult {
  /** True when the password meets the minimum requirements. */
  valid: boolean;
  /** 0-4 strength score for the meter. */
  score: number;
  /** Human-readable label derived from the score. */
  label: PasswordStrength;
  /** Unmet requirements, in display order. Empty when valid. */
  issues: string[];
}

export function validatePassword(password: string): PasswordResult {
  const issues: string[] = [];

  const hasLength = password.length >= MIN_PASSWORD_LENGTH;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasLength) issues.push(`At least ${MIN_PASSWORD_LENGTH} characters`);
  if (!hasLower) issues.push("A lowercase letter");
  if (!hasUpper) issues.push("An uppercase letter");
  if (!hasNumber) issues.push("A number");

  const valid = issues.length === 0;

  // Score: base requirements (length, lower, upper, number) plus bonuses for
  // symbols and extra length. Clamped to 0-4.
  let score = 0;
  if (hasLength) score += 1;
  if (hasLower && hasUpper) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol || password.length >= 12) score += 1;
  if (!valid) score = Math.min(score, 2);

  const label: PasswordStrength =
    score >= 4 ? "strong" : score === 3 ? "good" : score === 2 ? "fair" : "weak";

  return { valid, score, label, issues };
}
