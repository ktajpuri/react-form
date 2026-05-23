# React Form — Spec (no form libraries)

## 1. Goals

Build a reusable, performant, extensible form primitive in React with zero form-library dependencies. Supports `text`, `radio`, `dropdown`, and `image` fields, per-field validation, conditional visibility, and a JSON submit payload.

Design priorities (in order):
1. **Performance** — typing in one field must not re-render unrelated fields.
2. **Reusability** — one schema-driven `<Form/>` component for any form shape.
3. **Extensibility** — first-class custom field types and custom validation rules.

---

## 2. Public API

### 2.1 `<Form/>`

```tsx
<Form
  schema={schema}
  initialValues={{ name: "Ada" }}
  fields={{ myCustom: MyCustomField }}   // per-form registry override
  onSubmit={(values) => console.log(JSON.stringify(values, null, 2))}
/>
```

Props:

| prop | type | notes |
|---|---|---|
| `schema` | `FieldSchema[]` | Ordered list of fields to render. |
| `initialValues` | `Record<string, unknown>` | Optional. Defaults per field type otherwise. |
| `fields` | `Record<string, FieldComponent>` | Optional registry override (merged over context registry, then built-ins). |
| `onSubmit` | `(values: Record<string, unknown>) => void` | Called only when all visible fields are valid. |
| `onInvalidSubmit` | `(errors: Record<string, string>) => void` | Optional. |

### 2.2 `<FieldRegistryProvider/>`

App-level registration of custom field types. `<Form/>` merges in this order (later wins): built-ins → context registry → `fields` prop.

```tsx
<FieldRegistryProvider value={{ signature: SignatureField }}>
  <App />
</FieldRegistryProvider>
```

### 2.3 Schema

```ts
type FieldSchema =
  | TextFieldSchema
  | RadioFieldSchema
  | DropdownFieldSchema
  | ImageFieldSchema
  | CustomFieldSchema;

interface BaseFieldSchema {
  name: string;                         // unique key in output JSON
  label?: string;
  help?: string;
  visibleWhen?: (values: Values) => boolean;  // hidden => excluded from validation + output
  validate?: ValidationConfig;          // see §4
}

interface TextFieldSchema extends BaseFieldSchema {
  type: "text";
  placeholder?: string;
  multiline?: boolean;
}

interface RadioFieldSchema extends BaseFieldSchema {
  type: "radio";
  options: { label: string; value: string }[];
}

interface DropdownFieldSchema extends BaseFieldSchema {
  type: "dropdown";
  options: { label: string; value: string }[];
}

interface ImageFieldSchema extends BaseFieldSchema {
  type: "image";
  accept?: string;                      // default "image/*"
  maxSizeBytes?: number;                // enforced as built-in rule
}

interface CustomFieldSchema extends BaseFieldSchema {
  type: string;                         // resolved via registry
  [key: string]: unknown;               // arbitrary props forwarded to the field component
}
```

---

## 3. State management (perf model)

**Approach:** Controlled, but with **field-level subscriptions** so a keystroke in field A only re-renders field A (and any field whose `visibleWhen` depends on A — see §3.3).

### 3.1 Form store

A plain object held in a `useRef` inside `<Form/>`, exposed via context:

```ts
interface FormStore {
  getValue(name: string): unknown;
  getError(name: string): string | undefined;
  isVisible(name: string): boolean;
  setValue(name: string, value: unknown): void;     // also re-evaluates visibility graph
  setTouched(name: string): void;                   // triggers blur validation
  subscribe(name: string, listener: () => void): () => void;  // per-field
  subscribeMeta(listener: () => void): () => void;  // visibility/submit-state changes
  submit(): void;
}
```

State lives in mutable refs (`values`, `errors`, `touched`, `visible`). Mutating a field calls only that field's listeners — React state is **not** the source of truth at the form root.

### 3.2 `useField(name)` hook

Each field component subscribes only to its own slice:

```ts
function useField(name: string) {
  const store = useFormStore();
  const value = useSyncExternalStore(
    (cb) => store.subscribe(name, cb),
    () => store.getValue(name),
  );
  // same pattern for error, visible
  return { value, error, visible, setValue, onBlur };
}
```

`useSyncExternalStore` gives us tear-free, opt-in subscriptions without prop drilling or context-induced re-renders.

### 3.3 Visibility graph

On mount, the form walks `schema` and records which fields reference which others inside `visibleWhen` (best-effort by running each predicate against a Proxy that tracks reads). On every `setValue`, we recompute visibility **only for dependents** of the changed field and notify their subscribers.

Hidden fields:
- Skipped during validation.
- Omitted from the submit JSON.
- Their stored value is retained (so toggling visible→hidden→visible restores it), but never emitted.

### 3.4 Render cost summary

| Action | Re-renders |
|---|---|
| Typing in `text` | That field only. |
| Selecting a `radio` whose value gates another field | That field + dependent fields whose visibility flipped. |
| Submit | Fields whose error state changed. |

The form root itself never re-renders on input.

---

## 4. Validation

### 4.1 Config shape (declarative + escape hatch)

```ts
type ValidationConfig = {
  required?: boolean | string;          // string = custom error message
  minLength?: number | [number, string];
  maxLength?: number | [number, string];
  pattern?: RegExp | [RegExp, string];
  rules?: string[];                     // named rules from registry, e.g. ["email"]
  custom?: (value: unknown, values: Values) => string | null | Promise<string | null>;
};
```

### 4.2 Built-in rule registry

```ts
registerRule("email", (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) || "Invalid email");
registerRule("url",   (v) => { try { new URL(String(v)); return null; } catch { return "Invalid URL"; } });
```

Image field auto-applies an internal `__image_size` rule when `maxSizeBytes` is set, and a MIME check from `accept`.

### 4.3 When validation runs

- **On blur** of a field: validate that field only.
- **On submit**: validate all visible fields. First error scrolls into view.
- Not on every keystroke (perf + UX).
- After a field has shown an error, it re-validates on change too (so the error clears as the user fixes it). This is the only on-change validation path.

### 4.4 Async rules

`custom` may return a Promise. The field shows a pending state; submit waits for all pending validations to settle.

---

## 5. Field component contract

Every field — built-in or custom — is a component that uses `useField`:

```tsx
function TextField({ schema }: { schema: TextFieldSchema }) {
  const { value, error, setValue, onBlur } = useField(schema.name);
  return (
    <label>
      {schema.label}
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
      />
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
```

Required from a custom field:
- Call `useField(schema.name)` exactly once.
- Call `setValue` with a JSON-serializable value (the value that lands in the submit payload).
- Call `onBlur` to trigger blur validation.

That is the entire contract — anything else is the component's concern.

---

## 6. Built-in fields

| Type | Stored value | Notes |
|---|---|---|
| `text` | `string` | `multiline: true` → `<textarea>`. |
| `radio` | `string` | One of `options[].value`. |
| `dropdown` | `string` | Native `<select>` for v1 (accessibility + perf). |
| `image` | `string` (base64 data URL) | Reads file via `FileReader.readAsDataURL`. Preview rendered inline. |

### 6.1 Image field details

- Default `accept="image/*"`.
- `maxSizeBytes` enforced before read; oversized files set an error and do not populate `value`.
- Preview is `<img src={value}/>`. Clearing the input clears `value`.
- Base64 conversion is async; field shows pending state and submit awaits it.

---

## 7. Submit flow

1. Mark all visible fields as touched.
2. Run validators for all visible fields in parallel; await async ones.
3. If any errors: call `onInvalidSubmit(errors)`, focus first invalid field, abort.
4. Otherwise, build the output:

```ts
const output: Record<string, unknown> = {};
for (const field of schema) {
  if (!store.isVisible(field.name)) continue;
  output[field.name] = store.getValue(field.name);
}
onSubmit(output);
```

Output is **flat key-value**. Example:

```json
{
  "fullName": "Ada Lovelace",
  "role": "admin",
  "country": "GB",
  "avatar": "data:image/png;base64,iVBORw0KGgoAAA..."
}
```

---

## 8. Extensibility checklist

- **Add a new field type** → write a component that uses `useField`; register via `<FieldRegistryProvider/>` or the `fields` prop.
- **Add a validation rule** → `registerRule(name, fn)`; reference by name in `schema.validate.rules`.
- **Add cross-field logic** → use `visibleWhen` or `validate.custom(value, values)` (receives full values snapshot).
- **Theme/style** → fields render plain semantic HTML; styling is the consumer's responsibility (CSS modules, Tailwind, etc.). No styles shipped from the library.

---

## 9. File layout (proposed)

```
src/
  Form.tsx                  // <Form/>, owns the store
  store.ts                  // createFormStore, subscriptions, visibility graph
  useField.ts               // useField, useFormStore
  registry.tsx              // FieldRegistryProvider, default registry
  validation.ts             // runValidators, registerRule, built-in rules
  fields/
    TextField.tsx
    RadioField.tsx
    DropdownField.tsx
    ImageField.tsx
  types.ts                  // schema types
```

---

## 10. Out of scope (v1)

- Field arrays / repeating groups.
- Multi-step / wizard forms.
- Server-driven validation on submit (only client-side custom async rules).
- i18n of built-in error messages (strings are overridable via `[value, message]` tuples or `custom`).
- Styling / design system integration.

---

## 11. Open questions

1. Should `visibleWhen` predicates be expressed as data (e.g. `{ field: "role", equals: "admin" }`) instead of functions, so schemas are JSON-serializable end-to-end? Tradeoff: less power, but enables server-defined schemas.
2. Should the image field optionally downscale large images client-side before base64? (Reduces payload at cost of quality + a canvas dependency.)
3. Do we need a `dirty` concept distinct from `touched`, or is touched-only enough for v1?
