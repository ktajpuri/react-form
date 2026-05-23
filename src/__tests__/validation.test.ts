import { describe, expect, it } from "vitest";
import { registerRule, runValidation } from "../validation";
import type { FieldSchema } from "../types";

describe("runValidation", () => {
  it("required: empty string fails", async () => {
    const s: FieldSchema = { type: "text", name: "x", validate: { required: true } };
    expect(await runValidation(s, "", {})).toBe("This field is required");
  });

  it("required: custom message", async () => {
    const s: FieldSchema = {
      type: "text",
      name: "x",
      validate: { required: "Name please" },
    };
    expect(await runValidation(s, "", {})).toBe("Name please");
  });

  it("minLength tuple message", async () => {
    const s: FieldSchema = {
      type: "text",
      name: "x",
      validate: { minLength: [3, "Too short"] },
    };
    expect(await runValidation(s, "ab", {})).toBe("Too short");
  });

  it("maxLength enforced", async () => {
    const s: FieldSchema = { type: "text", name: "x", validate: { maxLength: 3 } };
    expect(await runValidation(s, "abcd", {})).toBe("Must be at most 3 characters");
  });

  it("pattern enforced", async () => {
    const s: FieldSchema = {
      type: "text",
      name: "x",
      validate: { pattern: /^\d+$/ },
    };
    expect(await runValidation(s, "abc", {})).toBe("Invalid format");
    expect(await runValidation(s, "123", {})).toBeNull();
  });

  it("built-in email rule", async () => {
    const s: FieldSchema = {
      type: "text",
      name: "x",
      validate: { rules: ["email"] },
    };
    expect(await runValidation(s, "not-email", {})).toBe("Invalid email");
    expect(await runValidation(s, "a@b.co", {})).toBeNull();
  });

  it("custom validator (sync)", async () => {
    const s: FieldSchema = {
      type: "text",
      name: "x",
      validate: { custom: (v) => (v === "bad" ? "nope" : null) },
    };
    expect(await runValidation(s, "bad", {})).toBe("nope");
    expect(await runValidation(s, "ok", {})).toBeNull();
  });

  it("custom validator (async)", async () => {
    const s: FieldSchema = {
      type: "text",
      name: "x",
      validate: { custom: async (v) => (v === "bad" ? "async-nope" : null) },
    };
    expect(await runValidation(s, "bad", {})).toBe("async-nope");
  });

  it("custom rule via registerRule", async () => {
    registerRule("even-length", (v) =>
      String(v).length % 2 === 0 ? null : "Must be even length",
    );
    const s: FieldSchema = {
      type: "text",
      name: "x",
      validate: { rules: ["even-length"] },
    };
    expect(await runValidation(s, "abc", {})).toBe("Must be even length");
    expect(await runValidation(s, "abcd", {})).toBeNull();
  });

  it("validators have access to all values via custom", async () => {
    const s: FieldSchema = {
      type: "text",
      name: "confirm",
      validate: {
        custom: (v, values) =>
          v === values.password ? null : "Passwords do not match",
      },
    };
    expect(
      await runValidation(s, "abc", { password: "xyz" }),
    ).toBe("Passwords do not match");
    expect(await runValidation(s, "abc", { password: "abc" })).toBeNull();
  });

  it("image: rejects oversized base64", async () => {
    const big = "x".repeat(1000);
    const dataUrl = `data:image/png;base64,${btoa(big)}`;
    const s: FieldSchema = {
      type: "image",
      name: "img",
      maxSizeBytes: 100,
    };
    const err = await runValidation(s, dataUrl, {});
    expect(err).toMatch(/too large/i);
  });

  it("image: rejects disallowed mime", async () => {
    const dataUrl = `data:application/pdf;base64,${btoa("hello")}`;
    const s: FieldSchema = {
      type: "image",
      name: "img",
      accept: "image/*",
    };
    const err = await runValidation(s, dataUrl, {});
    expect(err).toMatch(/not allowed/i);
  });

  it("image: accepts valid png within size limit", async () => {
    const dataUrl = `data:image/png;base64,${btoa("hello")}`;
    const s: FieldSchema = {
      type: "image",
      name: "img",
      accept: "image/*",
      maxSizeBytes: 1000,
    };
    expect(await runValidation(s, dataUrl, {})).toBeNull();
  });
});
