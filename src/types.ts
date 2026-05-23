export type Values = Record<string, unknown>;

export type ValidatorFn = (
  value: unknown,
  values: Values,
) => string | null | Promise<string | null>;

export interface ValidationConfig {
  required?: boolean | string;
  minLength?: number | [number, string];
  maxLength?: number | [number, string];
  pattern?: RegExp | [RegExp, string];
  rules?: string[];
  custom?: ValidatorFn;
}

export interface BaseFieldSchema {
  name: string;
  label?: string;
  help?: string;
  visibleWhen?: (values: Values) => boolean;
  validate?: ValidationConfig;
}

export interface TextFieldSchema extends BaseFieldSchema {
  type: "text";
  placeholder?: string;
  multiline?: boolean;
}

export interface RadioFieldSchema extends BaseFieldSchema {
  type: "radio";
  options: { label: string; value: string }[];
}

export interface DropdownFieldSchema extends BaseFieldSchema {
  type: "dropdown";
  options: { label: string; value: string }[];
  placeholder?: string;
}

export interface ImageFieldSchema extends BaseFieldSchema {
  type: "image";
  accept?: string;
  maxSizeBytes?: number;
}

export interface CustomFieldSchema extends BaseFieldSchema {
  type: string;
  // Forwarded props for custom field components
  [key: string]: unknown;
}

export type FieldSchema =
  | TextFieldSchema
  | RadioFieldSchema
  | DropdownFieldSchema
  | ImageFieldSchema
  | CustomFieldSchema;

export interface FieldComponentProps<S extends BaseFieldSchema = BaseFieldSchema> {
  schema: S;
}

export type FieldComponent<S extends BaseFieldSchema = BaseFieldSchema> =
  React.ComponentType<FieldComponentProps<S>>;
