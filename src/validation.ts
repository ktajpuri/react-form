import type {
  FieldSchema,
  ImageFieldSchema,
  ValidationConfig,
  ValidatorFn,
  Values,
} from "./types";

const ruleRegistry = new Map<string, ValidatorFn>();

export function registerRule(name: string, fn: ValidatorFn): void {
  ruleRegistry.set(name, fn);
}

export function getRule(name: string): ValidatorFn | undefined {
  return ruleRegistry.get(name);
}

registerRule("email", (v) => {
  if (v == null || v === "") return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) ? null : "Invalid email";
});

registerRule("url", (v) => {
  if (v == null || v === "") return null;
  try {
    new URL(String(v));
    return null;
  } catch {
    return "Invalid URL";
  }
});

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

function tupleOrValue<T>(x: T | [T, string]): [T, string | undefined] {
  if (Array.isArray(x) && x.length === 2 && typeof x[1] === "string") {
    return [x[0] as T, x[1]];
  }
  return [x as T, undefined];
}

export async function runValidation(
  schema: FieldSchema,
  value: unknown,
  values: Values,
): Promise<string | null> {
  const config: ValidationConfig | undefined = schema.validate;

  // Built-in: image size + mime
  if (schema.type === "image") {
    const imgErr = validateImage(schema as ImageFieldSchema, value);
    if (imgErr) return imgErr;
  }

  if (!config) return null;

  if (config.required) {
    if (isEmpty(value)) {
      return typeof config.required === "string"
        ? config.required
        : "This field is required";
    }
  }

  // Skip other checks if empty and not required
  if (isEmpty(value)) return null;

  if (config.minLength != null) {
    const [n, msg] = tupleOrValue(config.minLength);
    if (String(value).length < n) {
      return msg ?? `Must be at least ${n} characters`;
    }
  }

  if (config.maxLength != null) {
    const [n, msg] = tupleOrValue(config.maxLength);
    if (String(value).length > n) {
      return msg ?? `Must be at most ${n} characters`;
    }
  }

  if (config.pattern != null) {
    const [pat, msg] = tupleOrValue(config.pattern);
    if (!pat.test(String(value))) {
      return msg ?? "Invalid format";
    }
  }

  if (config.rules) {
    for (const ruleName of config.rules) {
      const fn = ruleRegistry.get(ruleName);
      if (!fn) {
        // eslint-disable-next-line no-console
        console.warn(`[react-form] Unknown rule: ${ruleName}`);
        continue;
      }
      const result = await fn(value, values);
      if (result) return result;
    }
  }

  if (config.custom) {
    const result = await config.custom(value, values);
    if (result) return result;
  }

  return null;
}

function validateImage(schema: ImageFieldSchema, value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;

  // Format: data:<mime>;base64,...
  const match = /^data:([^;]+);base64,(.*)$/.exec(value);
  if (!match) return null;
  const [, mime, b64] = match;

  if (schema.accept && schema.accept !== "*/*") {
    const accepts = schema.accept.split(",").map((s) => s.trim());
    const ok = accepts.some((a) => {
      if (a.endsWith("/*")) return mime.startsWith(a.slice(0, -1));
      return a === mime;
    });
    if (!ok) return `File type not allowed (got ${mime})`;
  }

  if (schema.maxSizeBytes) {
    // base64 decoded length ≈ ceil(b64.length / 4) * 3 - padding
    const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
    const size = Math.floor((b64.length * 3) / 4) - padding;
    if (size > schema.maxSizeBytes) {
      return `File too large (max ${schema.maxSizeBytes} bytes)`;
    }
  }

  return null;
}
