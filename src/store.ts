import type { FieldSchema, Values } from "./types";
import { runValidation } from "./validation";

export type SubmitResult =
  | { ok: true; values: Values }
  | { ok: false; errors: Record<string, string> };

export interface FormStore {
  // Reads
  getValue(name: string): unknown;
  getError(name: string): string | undefined;
  isVisible(name: string): boolean;
  isTouched(name: string): boolean;
  isPending(name: string): boolean;
  isSubmitting(): boolean;
  getFormError(): string | null;
  getValues(): Values;

  // Writes
  setValue(name: string, value: unknown): void;
  setTouched(name: string): void;
  setError(name: string, error: string | null): void;
  setFormError(error: string | null): void;
  setSubmitting(submitting: boolean): void;

  // Validation + submit
  validateField(name: string): Promise<string | null>;
  validateAll(): Promise<Record<string, string>>;
  submit(): Promise<SubmitResult>;

  // Focus registry (custom fields can register a focusable element)
  registerFocus(name: string, fn: () => void): () => void;
  focusField(name: string): void;

  // Subscriptions
  subscribe(name: string, listener: () => void): () => void;
  subscribeMeta(listener: () => void): () => void;
}

interface StoreOptions {
  schema: FieldSchema[];
  initialValues?: Values;
}

const DEFAULT_VALUES: Record<string, unknown> = {
  text: "",
  radio: "",
  dropdown: "",
  image: "",
};

export function createFormStore(opts: StoreOptions): FormStore {
  const { schema, initialValues = {} } = opts;

  const values: Values = {};
  const errors: Record<string, string> = {};
  const touched: Record<string, boolean> = {};
  const pending: Record<string, boolean> = {};
  const visible: Record<string, boolean> = {};
  let submitting = false;
  let formError: string | null = null;

  const fieldListeners = new Map<string, Set<() => void>>();
  const metaListeners = new Set<() => void>();
  const focusHandlers = new Map<string, () => void>();
  const visibilityDependents = new Map<string, Set<string>>();

  // Initialize values
  for (const field of schema) {
    values[field.name] =
      initialValues[field.name] !== undefined
        ? initialValues[field.name]
        : DEFAULT_VALUES[field.type] ?? "";
  }

  // Build visibility dependency graph using a tracking proxy
  function trackedRun(predicate: (v: Values) => boolean): {
    result: boolean;
    deps: Set<string>;
  } {
    const deps = new Set<string>();
    const proxy = new Proxy(values, {
      get(target, prop: string) {
        deps.add(prop);
        return target[prop];
      },
    });
    let result = true;
    try {
      result = !!predicate(proxy);
    } catch {
      result = false;
    }
    return { result, deps };
  }

  for (const field of schema) {
    if (field.visibleWhen) {
      const { result, deps } = trackedRun(field.visibleWhen);
      visible[field.name] = result;
      for (const dep of deps) {
        if (!visibilityDependents.has(dep)) {
          visibilityDependents.set(dep, new Set());
        }
        visibilityDependents.get(dep)!.add(field.name);
      }
    } else {
      visible[field.name] = true;
    }
  }

  const schemaByName = new Map(schema.map((f) => [f.name, f]));

  function notifyField(name: string) {
    const set = fieldListeners.get(name);
    if (set) {
      for (const listener of set) listener();
    }
  }

  function notifyMeta() {
    for (const listener of metaListeners) listener();
  }

  function recomputeVisibility(changedField: string) {
    const dependents = visibilityDependents.get(changedField);
    if (!dependents) return;
    for (const depName of dependents) {
      const field = schemaByName.get(depName);
      if (!field?.visibleWhen) continue;
      const next = !!field.visibleWhen(values);
      if (next !== visible[depName]) {
        visible[depName] = next;
        if (!next && errors[depName]) {
          delete errors[depName];
        }
        notifyField(depName);
      }
    }
  }

  const store: FormStore = {
    getValue(name) {
      return values[name];
    },
    getError(name) {
      return errors[name];
    },
    isVisible(name) {
      return visible[name] ?? true;
    },
    isTouched(name) {
      return !!touched[name];
    },
    isPending(name) {
      return !!pending[name];
    },
    isSubmitting() {
      return submitting;
    },
    getFormError() {
      return formError;
    },
    getValues() {
      return { ...values };
    },

    setValue(name, value) {
      values[name] = value;
      notifyField(name);
      recomputeVisibility(name);
      if (errors[name] !== undefined) {
        void store.validateField(name);
      }
    },

    setTouched(name) {
      touched[name] = true;
      void store.validateField(name);
    },

    setError(name, error) {
      const prev = errors[name];
      if (error === null || error === undefined) {
        delete errors[name];
      } else {
        errors[name] = error;
        touched[name] = true; // ensure inline error renders
      }
      if (prev !== errors[name]) notifyField(name);
    },

    setFormError(error) {
      if (formError !== error) {
        formError = error;
        notifyMeta();
      }
    },

    setSubmitting(next) {
      if (submitting !== next) {
        submitting = next;
        notifyMeta();
      }
    },

    async validateField(name) {
      const field = schemaByName.get(name);
      if (!field) return null;
      if (!visible[name]) {
        if (errors[name]) {
          delete errors[name];
          notifyField(name);
        }
        return null;
      }

      pending[name] = true;
      notifyField(name);

      const result = await runValidation(field, values[name], values);

      pending[name] = false;
      const prevError = errors[name];
      if (result) {
        errors[name] = result;
      } else {
        delete errors[name];
      }
      if (prevError !== errors[name]) {
        notifyField(name);
      } else {
        notifyField(name);
      }
      return result;
    },

    async validateAll() {
      const results = await Promise.all(
        schema
          .filter((f) => visible[f.name])
          .map(async (f) => {
            const err = await store.validateField(f.name);
            return [f.name, err] as const;
          }),
      );
      const out: Record<string, string> = {};
      for (const [name, err] of results) {
        if (err) out[name] = err;
      }
      return out;
    },

    async submit(): Promise<SubmitResult> {
      for (const f of schema) {
        if (visible[f.name]) touched[f.name] = true;
      }
      const errs = await store.validateAll();
      notifyMeta();
      if (Object.keys(errs).length > 0) {
        return { ok: false, errors: errs };
      }
      const output: Values = {};
      for (const f of schema) {
        if (visible[f.name]) output[f.name] = values[f.name];
      }
      return { ok: true, values: output };
    },

    registerFocus(name, fn) {
      focusHandlers.set(name, fn);
      return () => {
        if (focusHandlers.get(name) === fn) focusHandlers.delete(name);
      };
    },

    focusField(name) {
      const handler = focusHandlers.get(name);
      if (handler) {
        handler();
        return;
      }
      // Fallback: find an input/select/textarea with this name attribute.
      if (typeof document === "undefined") return;
      const el = document.querySelector<HTMLElement>(
        `input[name="${cssEscape(name)}"]:not([type=file]):not([type=hidden]),` +
          `select[name="${cssEscape(name)}"],` +
          `textarea[name="${cssEscape(name)}"]`,
      );
      if (el) {
        el.focus();
        el.scrollIntoView?.({ behavior: "smooth", block: "center" });
      }
    },

    subscribe(name, listener) {
      if (!fieldListeners.has(name)) {
        fieldListeners.set(name, new Set());
      }
      fieldListeners.get(name)!.add(listener);
      return () => {
        fieldListeners.get(name)?.delete(listener);
      };
    },

    subscribeMeta(listener) {
      metaListeners.add(listener);
      return () => {
        metaListeners.delete(listener);
      };
    },
  };

  return store;
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(s);
  }
  return s.replace(/["\\]/g, "\\$&");
}
