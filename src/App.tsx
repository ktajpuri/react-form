import { useEffect, useRef, useState } from "react";
import { Form } from "./Form";
import {
  createAccount,
  USING_MOCK_API,
  type CreateAccountResponse,
} from "./api";
import { MOCK_CONFIG, type MockMode } from "./api/mockApi";
import type { FieldSchema, Values } from "./types";
import { ResonanceField } from "./effects/ResonanceField";
import { IdentityCard } from "./effects/IdentityCard";
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const submitBtnObserverRef = useRef<MutationObserver | null>(null);

  function handleModeChange(next: MockMode) {
    setMockMode(next);
    MOCK_CONFIG.mode = next;
  }

  // Watch for newly-invalid inputs inside the form card — dispatch a shock
  // ring + red particle burst from each. Zero coupling to Form internals.
  useEffect(() => {
    const root = cardRef.current;
    if (!root) return;

    const seen = new WeakSet<Element>();

    function shockFor(el: Element) {
      if (!(el instanceof HTMLElement)) return;
      const r = el.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("resonance:shock", {
          detail: { x: r.left + r.width / 2, y: r.top + r.height / 2, hue: 8 },
        }),
      );
    }

    const obs = new MutationObserver((records) => {
      for (const rec of records) {
        if (rec.type === "attributes" && rec.attributeName === "aria-invalid") {
          const t = rec.target as Element;
          if (t.getAttribute("aria-invalid") === "true" && !seen.has(t)) {
            seen.add(t);
            shockFor(t);
          } else if (t.getAttribute("aria-invalid") !== "true") {
            seen.delete(t);
          }
        }
        // Form-level error banner appearing → big central shock
        for (const node of rec.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains("rf-form-error")) {
            const r = node.getBoundingClientRect();
            window.dispatchEvent(
              new CustomEvent("resonance:shock", {
                detail: { x: r.left + r.width / 2, y: r.top + r.height / 2, hue: 8 },
              }),
            );
          }
        }
      }
    });

    obs.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-invalid"],
    });
    submitBtnObserverRef.current = obs;
    return () => obs.disconnect();
  }, []);

  function fireBloomFromSubmit() {
    const btn = cardRef.current?.querySelector('button[type="submit"]');
    if (btn instanceof HTMLElement) {
      const r = btn.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("resonance:bloom", {
          detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
        }),
      );
    }
  }

  function reset() {
    setSubmitted(null);
    setSubmittedValues(null);
  }

  const revealed = submitted && submittedValues;

  return (
    <>
      <ResonanceField />
      <div className={`page${revealed ? " page--revealed" : ""}`}>
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

          {USING_MOCK_API && !revealed && (
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

          {!revealed && (
            <section className="card" ref={cardRef}>
              <Form
                schema={schema}
                submitLabel="Create account"
                submittingLabel="Creating account…"
                onSubmit={async (values, { setFieldError, setFormError }) => {
                  setSubmitted(null);
                  setSubmittedValues(null);
                  const result = await createAccount(values);

                  if (result.ok) {
                    fireBloomFromSubmit();
                    // Let the bloom animation breathe before swapping the UI
                    await new Promise((r) => setTimeout(r, 850));
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
          )}

          {revealed && (
            <IdentityCard
              values={submittedValues}
              id={submitted.id}
              onReset={reset}
            />
          )}

          <footer className="footer">
            {USING_MOCK_API
              ? "Using mock API — set VITE_USE_MOCK_API=false to hit the real one."
              : "Using real API."}
          </footer>
        </div>
      </div>
    </>
  );
}
