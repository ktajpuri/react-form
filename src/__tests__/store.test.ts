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
      onSubmit: () => {},
    });
    expect(store.getValue("name")).toBe("Ada");
    expect(store.getValue("role")).toBe("");
  });

  it("computes initial visibility from visibleWhen", () => {
    const store = createFormStore({
      schema: baseSchema,
      onSubmit: () => {},
    });
    expect(store.isVisible("adminCode")).toBe(false);
  });

  it("flips visibility when dependency changes", () => {
    const store = createFormStore({
      schema: baseSchema,
      onSubmit: () => {},
    });
    store.setValue("role", "admin");
    expect(store.isVisible("adminCode")).toBe(true);
    store.setValue("role", "user");
    expect(store.isVisible("adminCode")).toBe(false);
  });

  it("notifies only subscribers of the changed field on setValue", () => {
    const store = createFormStore({
      schema: baseSchema,
      onSubmit: () => {},
    });
    const nameListener = vi.fn();
    const roleListener = vi.fn();
    store.subscribe("name", nameListener);
    store.subscribe("role", roleListener);

    store.setValue("name", "A");
    expect(nameListener).toHaveBeenCalledTimes(1);
    expect(roleListener).not.toHaveBeenCalled();
  });

  it("notifies dependents when visibility flips", () => {
    const store = createFormStore({
      schema: baseSchema,
      onSubmit: () => {},
    });
    const adminListener = vi.fn();
    store.subscribe("adminCode", adminListener);
    store.setValue("role", "admin");
    expect(adminListener).toHaveBeenCalled();
  });

  it("validates a field on setTouched", async () => {
    const store = createFormStore({
      schema: baseSchema,
      onSubmit: () => {},
    });
    store.setTouched("name");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("name")).toBeTruthy();
  });

  it("re-validates after first error on subsequent change", async () => {
    const store = createFormStore({
      schema: baseSchema,
      onSubmit: () => {},
    });
    store.setTouched("name");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("name")).toBeTruthy();

    store.setValue("name", "Ada");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("name")).toBeUndefined();
  });

  it("submit excludes hidden fields and outputs flat key-value", async () => {
    const onSubmit = vi.fn();
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "user" },
      onSubmit,
    });
    await store.submit();
    expect(onSubmit).toHaveBeenCalledWith({ name: "Ada", role: "user" });
  });

  it("submit calls onInvalidSubmit when there are errors", async () => {
    const onSubmit = vi.fn();
    const onInvalidSubmit = vi.fn();
    const store = createFormStore({
      schema: baseSchema,
      onSubmit,
      onInvalidSubmit,
    });
    await store.submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onInvalidSubmit).toHaveBeenCalled();
    expect(Object.keys(onInvalidSubmit.mock.calls[0][0])).toContain("name");
  });

  it("submit validates conditionally-visible fields", async () => {
    const onSubmit = vi.fn();
    const onInvalidSubmit = vi.fn();
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "admin" },
      onSubmit,
      onInvalidSubmit,
    });
    await store.submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onInvalidSubmit.mock.calls[0][0]).toHaveProperty("adminCode");
  });

  it("submit includes visible conditional fields when valid", async () => {
    const onSubmit = vi.fn();
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "admin", adminCode: "abcdef" },
      onSubmit,
    });
    await store.submit();
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ada",
      role: "admin",
      adminCode: "abcdef",
    });
  });

  it("clears errors when a field becomes hidden", async () => {
    const store = createFormStore({
      schema: baseSchema,
      initialValues: { name: "Ada", role: "admin" },
      onSubmit: () => {},
    });
    store.setTouched("adminCode");
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getError("adminCode")).toBeTruthy();

    store.setValue("role", "user");
    expect(store.getError("adminCode")).toBeUndefined();
    expect(store.isVisible("adminCode")).toBe(false);
  });
});
