import { useEffect, useMemo, useRef, type FormEvent } from "react";
import { createFormStore, type FormStore } from "./store";
import { FormStoreContext, useFormState } from "./useField";
import { useFieldRegistry, type FieldRegistry } from "./registry";
import { TextField } from "./fields/TextField";
import { RadioField } from "./fields/RadioField";
import { DropdownField } from "./fields/DropdownField";
import { ImageField } from "./fields/ImageField";
import type {
  FieldSchema,
  SubmitHandler,
  SubmitHelpers,
  Values,
} from "./types";
import { FieldRenderer } from "./FieldRenderer";

const BUILTIN_FIELDS: FieldRegistry = {
  text: TextField as FieldRegistry[string],
  radio: RadioField as FieldRegistry[string],
  dropdown: DropdownField as FieldRegistry[string],
  image: ImageField as FieldRegistry[string],
};

export interface FormProps {
  schema: FieldSchema[];
  initialValues?: Values;
  fields?: FieldRegistry;
  onSubmit: SubmitHandler;
  onInvalidSubmit?: (errors: Record<string, string>) => void;
  submitLabel?: string;
  submittingLabel?: string;
  children?: React.ReactNode;
}

export function Form({
  schema,
  initialValues,
  fields,
  onSubmit,
  onInvalidSubmit,
  submitLabel = "Submit",
  submittingLabel = "Submitting…",
  children,
}: FormProps) {
  const contextRegistry = useFieldRegistry();

  const registry = useMemo<FieldRegistry>(
    () => ({ ...BUILTIN_FIELDS, ...contextRegistry, ...(fields ?? {}) }),
    [contextRegistry, fields],
  );

  const storeRef = useRef<FormStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createFormStore({ schema, initialValues });
  }
  const store = storeRef.current;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (store.isSubmitting()) return;

    const result = await store.submit();
    if (!result.ok) {
      focusFirstError(schema, result.errors, store);
      onInvalidSubmit?.(result.errors);
      return;
    }

    const helpers: SubmitHelpers = {
      setFieldError: (name, error) => store.setError(name, error),
      setFormError: (error) => store.setFormError(error),
    };

    store.setFormError(null);
    store.setSubmitting(true);
    try {
      await onSubmit(result.values, helpers);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      store.setFormError(message);
    } finally {
      store.setSubmitting(false);
      // If onSubmit set any field errors, focus the first one.
      const afterErrors = collectFieldErrors(schema, store);
      if (Object.keys(afterErrors).length > 0) {
        focusFirstError(schema, afterErrors, store);
      }
    }
  }

  return (
    <FormStoreContext.Provider value={store}>
      <form onSubmit={handleSubmit} noValidate>
        <FormErrorBanner />
        {schema.map((field) => (
          <FieldRenderer key={field.name} schema={field} registry={registry} />
        ))}
        {children}
        <FormSubmitButton label={submitLabel} pendingLabel={submittingLabel} />
      </form>
    </FormStoreContext.Provider>
  );
}

function FormErrorBanner() {
  const { formError } = useFormState();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [formError]);

  if (!formError) return null;
  return (
    <div ref={ref} className="rf-form-error" role="alert">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{formError}</span>
    </div>
  );
}

function FormSubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { submitting } = useFormState();
  return (
    <button
      type="submit"
      disabled={submitting}
      aria-busy={submitting}
      data-submitting={submitting || undefined}
    >
      {submitting ? (
        <>
          <span className="rf-spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function focusFirstError(
  schema: FieldSchema[],
  errors: Record<string, string>,
  store: FormStore,
) {
  for (const field of schema) {
    if (errors[field.name]) {
      store.focusField(field.name);
      return;
    }
  }
}

function collectFieldErrors(
  schema: FieldSchema[],
  store: FormStore,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of schema) {
    const err = store.getError(field.name);
    if (err) out[field.name] = err;
  }
  return out;
}
