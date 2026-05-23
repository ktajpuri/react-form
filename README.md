# react-form

A reusable, performant, extensible form primitive in React — no form libraries.

Supports `text`, `radio`, `dropdown`, `image` fields, per-field validation (declarative + custom), conditional visibility, custom field types.

See [SPEC.md](./SPEC.md) for the full design.

## Run

```bash
npm install
npm run dev        # demo at http://localhost:5173
npm test           # vitest
npm run typecheck
```

## Quick example

```tsx
import { Form } from "./src";

<Form
  schema={[
    { type: "text", name: "fullName", label: "Name", validate: { required: true } },
    { type: "dropdown", name: "role", label: "Role",
      options: [{label:"User",value:"user"},{label:"Admin",value:"admin"}] },
    { type: "text", name: "adminCode", label: "Admin code",
      visibleWhen: (v) => v.role === "admin",
      validate: { required: true, minLength: 6 } },
    { type: "image", name: "avatar", maxSizeBytes: 1_000_000 },
  ]}
  onSubmit={(values) => console.log(values)}
/>
```
