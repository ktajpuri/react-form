import type { FieldSchema, Values } from "./types";
import { runValidation } from "./validation";

export interface FormStore {
  getValue(name: string): unknown;
  getError(name: string): string | undefined;
  isVisible(name: string): boolean;
  isTouched(name: string): boolean;
  isPending(name: string): boolean;
  getValues(): Values;

  setValue(name: string, value: unknown): void;
  setTouched(name: string): void;

  validateField(name: string): Promise<string | null>;
  validateAll(): Promise<Record<string, string>>;
  submit(): Promise<void>;

  subscribe(name: string, listener: () => void): () => void;
  subscribeMeta(listener: () => void): () => void;
}

interface StoreOptions {
  schema: FieldSchema[];
  initialValues?: Values;
  onSubmit: (values: Values) => void;
  onInvalidSubmit?: (errors: Record<string, string>) => void;
}

const DEFAULT_VALUES: Record<string, unknown> = {
  text: "",
  radio: "",
  dropdown: "",
  image: "",
};

export function createFormStore(opts: StoreOptions): FormStore {
  const { schema, initialValues = {}, onSubmit, onInvalidSubmit } = opts;

  const values: Values = {};
  const errors: Record<string, string> = {};
  const touched: Record<string, boolean> = {};
  const pending: Record<string, boolean> = {};
  const visible: Record<string, boolean> = {};

  const fieldListeners = new Map<string, Set<() => void>>();
  const metaListeners = new Set<() => void>();

  // Dependency graph: field name -> set of field names whose visibleWhen depends on it
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
        // Clear errors for fields that became hidden
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
    getValues() {
      return { ...values };
    },

    setValue(name, value) {
      values[name] = value;
      notifyField(name);
      recomputeVisibility(name);

      // Re-validate this field on change ONLY if it has already shown an error.
      // This lets the error clear as the user fixes the input.
      if (errors[name] !== undefined) {
        void store.validateField(name);
      }
    },

    setTouched(name) {
      touched[name] = true;
      void store.validateField(name);
    },

    async validateField(name) {
      const field = schemaByName.get(name);
      if (!field) return null;
      if (!visible[name]) {
        // Hidden fields are not validated; clear any stale error
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
        // Still need to clear pending indicator
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

    async submit() {
      // Mark all visible fields as touched
      for (const f of schema) {
        if (visible[f.name]) touched[f.name] = true;
      }
      const errs = await store.validateAll();
      notifyMeta();
      if (Object.keys(errs).length > 0) {
        onInvalidSubmit?.(errs);
        return;
      }
      const output: Values = {};
      for (const f of schema) {
        if (visible[f.name]) output[f.name] = values[f.name];
      }
      onSubmit(output);
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
