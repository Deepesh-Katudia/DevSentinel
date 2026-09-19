import { describe, expect, test } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  test("lowercases and hyphenates words", () => {
    expect(slugify("Acme Engineering")).toBe("acme-engineering");
  });

  test("collapses punctuation and repeated separators into one hyphen", () => {
    // The old generator produced "acme--co", which the API now rejects.
    expect(slugify("Acme & Co")).toBe("acme-co");
    expect(slugify("Team   42__Ops")).toBe("team-42-ops");
  });

  test("trims leading and trailing hyphens", () => {
    expect(slugify("  --Acme!-- ")).toBe("acme");
  });

  test("strips accents instead of dropping the letter", () => {
    expect(slugify("Café Réseau")).toBe("cafe-reseau");
  });

  test("caps the length at 48 without leaving a trailing hyphen", () => {
    const slug = slugify("word ".repeat(20));
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});
