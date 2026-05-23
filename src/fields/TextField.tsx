import { useRef } from "react";
import { useField, useFieldFocus } from "../useField";
import type { FieldComponentProps, TextFieldSchema } from "../types";

export function TextField({ schema }: FieldComponentProps<TextFieldSchema>) {
  const { value, error, touched, setValue, onBlur } = useField(schema.name);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  useFieldFocus(schema.name, inputRef);

  const showError = touched && error;
  const id = `field-${schema.name}`;

  const common = {
    id,
    name: schema.name,
    value: (value as string) ?? "",
    placeholder: schema.placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(e.target.value),
    onBlur,
    "aria-invalid": !!showError,
    "aria-describedby": showError ? `${id}-error` : undefined,
  };

  return (
    <div className="rf-field rf-field--text">
      {schema.label && <label htmlFor={id}>{schema.label}</label>}
      {schema.multiline ? (
        <textarea
          {...common}
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        />
      ) : (
        <input
          type="text"
          {...common}
          ref={inputRef as React.RefObject<HTMLInputElement>}
        />
      )}
      {schema.help && <p className="rf-help">{schema.help}</p>}
      {showError && (
        <p id={`${id}-error`} className="rf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
