import { useRef } from "react";
import { useField, useFieldFocus } from "../useField";
import type { FieldComponentProps, RadioFieldSchema } from "../types";

export function RadioField({ schema }: FieldComponentProps<RadioFieldSchema>) {
  const { value, error, touched, setValue, onBlur } = useField(schema.name);
  const firstRadioRef = useRef<HTMLInputElement>(null);
  useFieldFocus(schema.name, firstRadioRef);

  const showError = touched && error;
  const groupId = `field-${schema.name}`;

  return (
    <fieldset
      className="rf-field rf-field--radio"
      aria-invalid={!!showError}
      aria-describedby={showError ? `${groupId}-error` : undefined}
    >
      {schema.label && <legend>{schema.label}</legend>}
      {schema.options.map((opt, i) => {
        const id = `${groupId}-${opt.value}`;
        return (
          <label key={opt.value} htmlFor={id}>
            <input
              ref={i === 0 ? firstRadioRef : undefined}
              type="radio"
              id={id}
              name={schema.name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => setValue(opt.value)}
              onBlur={onBlur}
            />
            {opt.label}
          </label>
        );
      })}
      {schema.help && <p className="rf-help">{schema.help}</p>}
      {showError && (
        <p id={`${groupId}-error`} className="rf-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
