import { describe, expect, it, vi } from "vitest";
import { createFormStore } from "../store";
import type { FieldSchema } from "../types";

const baseSchema: FieldSchema[] = [
  { type: "text", name: "name", validate: { required: true, minLength: 2 } },
  {
    type: "dropdown",
    name: "role",
    options: [
      { label: "User", value: "user" },
      { label: "Admin", value: "admin" },
    ],
  },
  {
    type: "text",
    name: "adminCode",
    visibleWhen: (v) => v.role === "admin",
    validate: { required: true, minLength: 4 },
  },
];

describe("createFormStore", () => {
  it("initializes values with type defaults and initialValues overrides", () => {
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada" },
    });
    expect(store.getValue("name")).toBe("Ada");
    expect(store.getValue("role")).toBe("");
  });

  it("computes initial visibility from visibleWhen", () => {
    const store = createFormStore({ schema: baseSchema });
    expect(store.isVisible("adminCode")).toBe(false);
  });

  it("flips visibility when dependency changes", () => {
    const store = createFormStore({ schema: baseSchema });
    store.setValue("role", "admin");
    expect(store.isVisible("adminCode")).toBe(true);
    store.setValue("role", "user");
    expect(store.isVisible("adminCode")).toBe(false);
  });

  it("notifies only subscribers of the changed field on setValue", () => {
    const store = createFormStore({ schema: baseSchema });
    const nameListener = vi.fn();
    const roleListener = vi.fn();
    store.subscribe("name", nameListener);
    store.subscribe("role", roleListener);

    store.setValue("name", "A");
    expect(nameListener).toHaveBeenCalledTimes(1);
    expect(roleListener).not.toHaveBeenCalled();
  });

  it("notifies dependents when visibility flips", () => {
    const store = createFormStore({ schema: baseSchema });
    const adminListener = vi.fn();
    store.subscribe("adminCode", adminListener);
    store.setValue("role", "admin");
    expect(adminListener).toHaveBeenCalled();
  });

  it("validates a field on setTouched", async () => {
    const store = createFormStore({ schema: baseSchema });
    store.setTouched("name");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("name")).toBeTruthy();
  });

  it("re-validates after first error on subsequent change", async () => {
    const store = createFormStore({ schema: baseSchema });
    store.setTouched("name");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("name")).toBeTruthy();

    store.setValue("name", "Ada");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("name")).toBeUndefined();
  });

  it("submit returns ok=true with values excluding hidden fields", async () => {
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "user" },
    });
    const result = await store.submit();
    expect(result).toEqual({
      ok: true,
      values: { name: "Ada", role: "user" },
    });
  });

  it("submit returns ok=false with errors when invalid", async () => {
    const store = createFormStore({ schema: baseSchema });
    const result = await store.submit();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors)).toContain("name");
    }
  });

  it("submit validates conditionally-visible fields", async () => {
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "admin" },
    });
    const result = await store.submit();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveProperty("adminCode");
  });

  it("submit includes visible conditional fields when valid", async () => {
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "admin", adminCode: "abcdef" },
    });
    const result = await store.submit();
    expect(result).toEqual({
      ok: true,
      values: { name: "Ada", role: "admin", adminCode: "abcdef" },
    });
  });

  it("clears errors when a field becomes hidden", async () => {
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "admin" },
    });
    store.setTouched("adminCode");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("adminCode")).toBeTruthy();

    store.setValue("role", "user");
    expect(store.getError("adminCode")).toBeUndefined();
    expect(store.isVisible("adminCode")).toBe(false);
  });

  it("setError sets an external error and marks the field touched", () => {
    const store = createFormStore({ schema: baseSchema });
    store.setError("name", "Already taken");
    expect(store.getError("name")).toBe("Already taken");
    expect(store.isTouched("name")).toBe(true);
  });

  it("setError(null) clears the error", () => {
    const store = createFormStore({ schema: baseSchema });
    store.setError("name", "Boom");
    store.setError("name", null);
    expect(store.getError("name")).toBeUndefined();
  });

  it("setFormError + isSubmitting fire meta listeners", () => {
    const store = createFormStore({ schema: baseSchema });
    const meta = vi.fn();
    store.subscribeMeta(meta);
    store.setFormError("Boom");
    expect(store.getFormError()).toBe("Boom");
    store.setSubmitting(true);
    expect(store.isSubmitting()).toBe(true);
    expect(meta).toHaveBeenCalledTimes(2);
  });

  it("registerFocus + focusField invokes the registered handler", () => {
    const store = createFormStore({ schema: baseSchema });
    const handler = vi.fn();
    store.registerFocus("name", handler);
    store.focusField("name");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
