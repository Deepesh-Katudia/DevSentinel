import { describe, expect, test } from "vitest";
import { formatApiErrorDetail } from "./api-error";

describe("formatApiErrorDetail", () => {
  test("returns string details unchanged", () => {
    expect(formatApiErrorDetail("Slug 'acme' is already taken", 409)).toBe("Slug 'acme' is already taken");
  });

  test("turns FastAPI validation errors into readable text", () => {
    // 422 bodies carry a list; passing it to new Error() rendered "[object Object]".
    const detail = [
      { loc: ["body", "slug"], msg: "Value error, Slug must be 3-48 characters", type: "value_error" },
      { loc: ["body", "name"], msg: "Value error, Organisation name is required", type: "value_error" },
    ];

    expect(formatApiErrorDetail(detail, 422)).toBe(
      "Slug must be 3-48 characters. Organisation name is required"
    );
  });

  test("falls back to the status code when there is no usable detail", () => {
    expect(formatApiErrorDetail(undefined, 503)).toBe("Request failed (HTTP 503)");
    expect(formatApiErrorDetail([], 422)).toBe("Request failed (HTTP 422)");
  });
});
