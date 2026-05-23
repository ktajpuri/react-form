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
    label: "Plan",
    options: [
      { label: "Free", value: "free" },
      { label: "Pro", value: "pro" },
      { label: "Enterprise", value: "enterprise" },
    ],
    validate: { required: "Pick a plan" },
  },
  {
    type: "dropdown",
    name: "role",
    label: "Role",
    placeholder: "Select a role",
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
    placeholder: "At least 6 characters",
    help: "Required for admin accounts",
    visibleWhen: (v) => v.role === "admin",
    validate: { required: true, minLength: 6 },
  },
  {
    type: "text",
    name: "bio",
    label: "Short bio",
    placeholder: "Tell us a bit about yourself…",
    multiline: true,
    validate: { maxLength: [200, "Keep it under 200 characters"] },
  },
  {
    type: "image",
    name: "avatar",
    label: "Avatar",
    accept: "image/*",
    maxSizeBytes: 2_000_000,
    help: "PNG or JPG, up to 2 MB",
  },
];

export function App() {
  const [submitted, setSubmitted] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="hero-eyebrow">
            <span className="hero-dot" />
            Live demo
          </div>
          <h1 className="hero-title">Create your account</h1>
          <p className="hero-subtitle">
            A schema-driven React form, with no form libraries.
            Try switching <strong>Role</strong> to <em>Admin</em>.
          </p>
        </header>

        <section className="card">
          <Form
            schema={schema}
            submitLabel="Create account"
            onSubmit={(values) => {
              setSubmitted(values);
              setErrors(null);
            }}
            onInvalidSubmit={(errs) => {
              setErrors(errs);
              setSubmitted(null);
            }}
          />
        </section>

        {errors && (
          <section className="output output--error">
            <div className="output-header">
              <span className="output-title">Validation errors</span>
              <span className="output-pill output-pill--error">
                {Object.keys(errors).length}
              </span>
            </div>
            <pre className="output-body">{JSON.stringify(errors, null, 2)}</pre>
          </section>
        )}

        {submitted && (
          <section className="output output--success">
            <div className="output-header">
              <span className="output-title">Submitted payload</span>
              <span className="output-pill output-pill--success">JSON</span>
            </div>
            <pre className="output-body">
              {JSON.stringify(truncateImages(submitted), null, 2)}
            </pre>
          </section>
        )}

        <footer className="footer">Built without form libraries.</footer>
      </div>
    </div>
  );
}

function truncateImages(v: Values): Values {
  const out: Values = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && val.startsWith("data:image/")) {
      out[k] = `${val.slice(0, 48)}… (${val.length} chars)`;
    } else {
      out[k] = val;
    }
  }
  return out;
}
