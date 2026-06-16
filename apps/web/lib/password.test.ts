import { describe, expect, test } from "vitest";
import { validatePassword, MIN_PASSWORD_LENGTH } from "./password";

describe("validatePassword", () => {
  test("rejects a password shorter than the minimum length", () => {
    const result = validatePassword("Ab1");
    expect(result.valid).toBe(false);
    expect(result.issues).toContain(`At least ${MIN_PASSWORD_LENGTH} characters`);
  });

  test("rejects a password missing an uppercase letter", () => {
    const result = validatePassword("lowercase1");
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("An uppercase letter");
  });

  test("rejects a password missing a number", () => {
    const result = validatePassword("NoNumbersHere");
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("A number");
  });

  test("accepts a password meeting all requirements", () => {
    const result = validatePassword("GoodPass1");
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("rates a long password with symbols as strong", () => {
    const result = validatePassword("Str0ng-Passw0rd!");
    expect(result.valid).toBe(true);
    expect(result.label).toBe("strong");
    expect(result.score).toBe(4);
  });

  test("caps the score for invalid passwords", () => {
    const result = validatePassword("abcdefgh");
    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThanOrEqual(2);
    expect(result.label).not.toBe("strong");
  });

  test("an empty password is weak and invalid", () => {
    const result = validatePassword("");
    expect(result.valid).toBe(false);
    expect(result.label).toBe("weak");
  });
});
