import { describe, expect, test } from "bun:test";
import { isArchitectureEnabled } from "./access";

describe("isArchitectureEnabled", () => {
  test("allows development only", () => {
    expect(isArchitectureEnabled("development")).toBe(true);
    expect(isArchitectureEnabled("production")).toBe(false);
    expect(isArchitectureEnabled("test")).toBe(false);
    expect(isArchitectureEnabled(undefined)).toBe(false);
  });
});
