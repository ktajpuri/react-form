import type { Values } from "../types";
import type { ApiResult, CreateAccountResponse } from "./mockApi";

/**
 * Real backend implementation. The mock and real APIs share types
 * so swapping is type-safe. Drop in your endpoint and you're done.
 */
export async function createAccount(
  values: Values,
): Promise<ApiResult<CreateAccountResponse>> {
  let res: Response;
  try {
    res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
  } catch (err) {
    // Network failure surfaces as a thrown error — let the Form catch it.
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (res.ok) {
    const data = (await res.json()) as CreateAccountResponse;
    return { ok: true, data };
  }

  // 422 → field-level validation problems
  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      fieldErrors?: Record<string, string>;
    };
    return {
      ok: false,
      error: {
        message: body.message ?? "Validation failed",
        fieldErrors: body.fieldErrors,
      },
    };
  }

  // Anything else → top-level error
  const body = (await res.text().catch(() => "")) || res.statusText;
  return {
    ok: false,
    error: { message: `Request failed (${res.status}): ${body}` },
  };
}
