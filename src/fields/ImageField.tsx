import { useRef, useState } from "react";
import { useField } from "../useField";
import type { FieldComponentProps, ImageFieldSchema } from "../types";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ImageField({ schema }: FieldComponentProps<ImageFieldSchema>) {
  const { value, error, touched, setValue, onBlur } = useField(schema.name);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showError = touched && error;
  const id = `field-${schema.name}`;

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setValue("");
      return;
    }
    setReading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      setValue(dataUrl);
    } catch {
      setValue("");
    } finally {
      setReading(false);
      // Trigger blur-style validation now that value is set
      onBlur();
    }
  }

  function clear() {
    setValue("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const dataUrl = typeof value === "string" ? value : "";

  return (
    <div className="rf-field rf-field--image">
      {schema.label && <label htmlFor={id}>{schema.label}</label>}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={schema.accept ?? "image/*"}
        onChange={handleChange}
        onBlur={onBlur}
        aria-invalid={!!showError}
        aria-describedby={showError ? `${id}-error` : undefined}
      />
      {reading && <p className="rf-pending">Reading...</p>}
      {dataUrl && (
        <div className="rf-image-preview">
          <img src={dataUrl} alt="preview" style={{ maxWidth: 200 }} />
          <button type="button" onClick={clear}>
            Clear
          </button>
        </div>
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
