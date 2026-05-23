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
      {schema.label && (
        <label htmlFor={id} className="rf-label">
          {schema.label}
        </label>
      )}

      {dataUrl ? (
        <div className="rf-image-filled">
          <img className="rf-image-preview" src={dataUrl} alt="Preview" />
          <div className="rf-image-meta">
            <div className="rf-image-name">Image uploaded</div>
            <button
              type="button"
              className="rf-image-remove"
              onClick={clear}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label htmlFor={id} className="rf-dropzone">
          <svg
            className="rf-dropzone-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="rf-dropzone-text">
            <span className="rf-dropzone-primary">Click to upload</span>
            <span className="rf-dropzone-hint">
              {schema.help ?? "PNG, JPG"}
            </span>
          </div>
        </label>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={schema.accept ?? "image/*"}
        onChange={handleChange}
        onBlur={onBlur}
        className="rf-visually-hidden"
        aria-invalid={!!showError}
        aria-describedby={showError ? `${id}-error` : undefined}
      />

      {reading && <p className="rf-pending">Reading…</p>}
      {showError && (
        <p id={`${id}-error`} className="rf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
