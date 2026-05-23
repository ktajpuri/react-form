import { useState } from "react";
import { Form } from "./Form";
import {
  createAccount,
  USING_MOCK_API,
  type CreateAccountResponse,
} from "./api";
import { MOCK_CONFIG, type MockMode } from "./api/mockApi";
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

const MOCK_MODES: { value: MockMode; label: string; description: string }[] = [
  { value: "success", label: "Success", description: "Happy path" },
  { value: "field-error", label: "Field error", description: "Email already in use" },
  { value: "server-error", label: "Server error", description: "Top-of-form 500" },
  { value: "network-error", label: "Network error", description: "fetch rejects" },
  { value: "slow", label: "Slow", description: "3.5s delay" },
];

export function App() {
  const [submitted, setSubmitted] = useState<CreateAccountResponse | null>(null);
  const [submittedValues, setSubmittedValues] = useState<Values | null>(null);
  const [mockMode, setMockMode] = useState<MockMode>(MOCK_CONFIG.mode);

  function handleModeChange(next: MockMode) {
    setMockMode(next);
    MOCK_CONFIG.mode = next;
  }

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

        {USING_MOCK_API && (
          <section className="mock-panel" aria-label="Mock API controls">
            <div className="mock-panel-header">
              <span className="mock-panel-title">Mock API</span>
              <span className="mock-panel-hint">
                Pick a response to test how the form handles it.
              </span>
            </div>
            <div className="mock-modes">
              {MOCK_MODES.map((m) => (
                <label
                  key={m.value}
                  className={`mock-mode ${mockMode === m.value ? "is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="mock-mode"
                    value={m.value}
                    checked={mockMode === m.value}
                    onChange={() => handleModeChange(m.value)}
                  />
                  <span className="mock-mode-label">{m.label}</span>
                  <span className="mock-mode-desc">{m.description}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <Form
            schema={schema}
            submitLabel="Create account"
            submittingLabel="Creating account…"
            onSubmit={async (values, { setFieldError, setFormError }) => {
              setSubmitted(null);
              setSubmittedValues(null);
              const result = await createAccount(values);

              if (result.ok) {
                setSubmitted(result.data);
                setSubmittedValues(values);
                return;
              }

              setFormError(result.error.message);
              if (result.error.fieldErrors) {
                for (const [name, message] of Object.entries(
                  result.error.fieldErrors,
                )) {
                  setFieldError(name, message);
                }
              }
            }}
          />
        </section>

        {submitted && submittedValues && (
          <section className="output output--success">
            <div className="output-header">
              <span className="output-title">Account created</span>
              <span className="output-pill output-pill--success">
                {submitted.id}
              </span>
            </div>
            <pre className="output-body">
              {JSON.stringify(
                {
                  response: submitted,
                  values: truncateImages(submittedValues),
                },
                null,
                2,
              )}
            </pre>
          </section>
        )}

        <footer className="footer">
          {USING_MOCK_API
            ? "Using mock API — set VITE_USE_MOCK_API=false to hit the real one."
            : "Using real API."}
        </footer>
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
