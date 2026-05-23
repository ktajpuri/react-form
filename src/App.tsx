import { useState } from "react";
import { Form } from "./Form";
import type { FieldSchema, Values } from "./types";
import "./demo.css";

const schema: FieldSchema[] = [
  {
    type: "text",
    name: "fullName",
    label: "Full name",
    placeholder: "Ada Lovelace",
    validate: { required: true, minLength: 2 },
  },
  {
    type: "text",
    name: "email",
    label: "Email",
    placeholder: "you@example.com",
    validate: { required: true, rules: ["email"] },
  },
  {
    type: "radio",
    name: "tier",
    label: "Tier",
    options: [
      { label: "Free", value: "free" },
      { label: "Pro", value: "pro" },
      { label: "Enterprise", value: "enterprise" },
    ],
    validate: { required: "Pick a tier" },
  },
  {
    type: "dropdown",
    name: "role",
    label: "Role",
    options: [
      { label: "User", value: "user" },
      { label: "Admin", value: "admin" },
    ],
    validate: { required: true },
  },
  {
    type: "text",
    name: "adminCode",
    label: "Admin code",
    help: "Required for admins",
    visibleWhen: (v) => v.role === "admin",
    validate: { required: true, minLength: 6 },
  },
  {
    type: "text",
    name: "bio",
    label: "Bio",
    multiline: true,
    validate: { maxLength: [200, "Keep it under 200 chars"] },
  },
  {
    type: "image",
    name: "avatar",
    label: "Avatar",
    accept: "image/*",
    maxSizeBytes: 2_000_000,
    help: "PNG/JPG, max 2 MB",
  },
];

export function App() {
  const [submitted, setSubmitted] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  return (
    <div className="demo-container">
      <h1>react-form demo</h1>
      <p>No form libraries. Field-level subscriptions. Try toggling Role → Admin.</p>

      <Form
        schema={schema}
        onSubmit={(values) => {
          setSubmitted(values);
          setErrors(null);
        }}
        onInvalidSubmit={(errs) => {
          setErrors(errs);
          setSubmitted(null);
        }}
      />

      {errors && (
        <div className="output">
          <h2>Validation errors</h2>
          <pre>{JSON.stringify(errors, null, 2)}</pre>
        </div>
      )}

      {submitted && (
        <div className="output">
          <h2>Submitted JSON</h2>
          <pre>{JSON.stringify(truncateImages(submitted), null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function truncateImages(v: Values): Values {
  const out: Values = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && val.startsWith("data:image/")) {
      out[k] = `${val.slice(0, 40)}... (${val.length} chars)`;
    } else {
      out[k] = val;
    }
  }
  return out;
}
