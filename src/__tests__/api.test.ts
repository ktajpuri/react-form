import { afterEach, describe, expect, it } from "vitest";
import { MOCK_CONFIG, createAccount, type MockMode } from "../api/mockApi";

const original = { ...MOCK_CONFIG };

afterEach(() => {
  MOCK_CONFIG.mode = original.mode;
  MOCK_CONFIG.delayMs = original.delayMs;
  MOCK_CONFIG.slowDelayMs = original.slowDelayMs;
});

function set(mode: MockMode, delay = 0) {
  MOCK_CONFIG.mode = mode;
  MOCK_CONFIG.delayMs = delay;
  MOCK_CONFIG.slowDelayMs = delay;
}

describe("mockApi.createAccount", () => {
  it("returns ok with an id on success", async () => {
    set("success");
    const result = await createAccount({ name: "Ada" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toMatch(/^usr_/);
      expect(typeof result.data.createdAt).toBe("string");
    }
  });

  it("returns field-level errors", async () => {
    set("field-error");
    const result = await createAccount({ email: "x@y.com" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fieldErrors).toEqual({
        email: "This email is already registered.",
      });
      expect(result.error.message).toBeTruthy();
    }
  });

  it("returns a top-level server error", async () => {
    set("server-error");
    const result = await createAccount({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/500/);
      expect(result.error.fieldErrors).toBeUndefined();
    }
  });

  it("throws on network error", async () => {
    set("network-error");
    await expect(createAccount({})).rejects.toThrow(/network/i);
  });

  it("uses slowDelayMs for slow mode", async () => {
    set("slow", 0);
    MOCK_CONFIG.slowDelayMs = 5;
    const start = Date.now();
    const result = await createAccount({});
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(4);
  });
});
