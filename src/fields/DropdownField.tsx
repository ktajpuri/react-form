import { useRef } from "react";
import { useField, useFieldFocus } from "../useField";
import type { DropdownFieldSchema, FieldComponentProps } from "../types";

export function DropdownField({
  schema,
}: FieldComponentProps<DropdownFieldSchema>) {
  const { value, error, touched, setValue, onBlur } = useField(schema.name);
  const selectRef = useRef<HTMLSelectElement>(null);
  useFieldFocus(schema.name, selectRef);

  const showError = touched && error;
  const id = `field-${schema.name}`;

  return (
    <div className="rf-field rf-field--dropdown">
      {schema.label && <label htmlFor={id}>{schema.label}</label>}
      <select
        ref={selectRef}
        id={id}
        name={schema.name}
        value={(value as string) ?? ""}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!showError}
        aria-describedby={showError ? `${id}-error` : undefined}
      >
        <option value="">{schema.placeholder ?? "Select..."}</option>
        {schema.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {schema.help && <p className="rf-help">{schema.help}</p>}
      {showError && (
        <p id={`${id}-error`} className="rf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
