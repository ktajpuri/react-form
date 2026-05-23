import { useMemo, useRef, type FormEvent } from "react";
import { createFormStore, type FormStore } from "./store";
import { FormStoreContext } from "./useField";
import { useFieldRegistry, type FieldRegistry } from "./registry";
import { TextField } from "./fields/TextField";
import { RadioField } from "./fields/RadioField";
import { DropdownField } from "./fields/DropdownField";
import { ImageField } from "./fields/ImageField";
import type { FieldSchema, Values } from "./types";
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
  onSubmit: (values: Values) => void;
  onInvalidSubmit?: (errors: Record<string, string>) => void;
  submitLabel?: string;
  children?: React.ReactNode;
}

export function Form({
  schema,
  initialValues,
  fields,
  onSubmit,
  onInvalidSubmit,
  submitLabel = "Submit",
  children,
}: FormProps) {
  const contextRegistry = useFieldRegistry();

  const registry = useMemo<FieldRegistry>(
    () => ({ ...BUILTIN_FIELDS, ...contextRegistry, ...(fields ?? {}) }),
    [contextRegistry, fields],
  );

  // Store is created once and stable for the lifetime of the form.
  // We intentionally do not re-create on schema changes to preserve perf model;
  // if the consumer needs a different schema, they should remount the form (with a `key`).
  const storeRef = useRef<FormStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createFormStore({
      schema,
      initialValues,
      onSubmit,
      onInvalidSubmit,
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void storeRef.current!.submit();
  }

  return (
    <FormStoreContext.Provider value={storeRef.current}>
      <form onSubmit={handleSubmit} noValidate>
        {schema.map((field) => (
          <FieldRenderer key={field.name} schema={field} registry={registry} />
        ))}
        {children}
        <button type="submit">{submitLabel}</button>
      </form>
    </FormStoreContext.Provider>
  );
}
