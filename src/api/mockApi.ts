import type { Values } from "../types";

// =========================================================
// CONFIG — toggle here to exercise different states
// =========================================================
//
// `mode`         — what the API does:
//   "success"        normal happy path
//   "field-error"    422-style response with per-field messages
//   "server-error"   500-style top-of-form error
//   "network-error"  promise rejects (fetch/network failed)
//   "slow"           success, but with extra delay
//
// `delayMs`      — base latency for all modes except "slow"
// `slowDelayMs`  — latency for "slow" mode
//

export type MockMode =
  | "success"
  | "field-error"
  | "server-error"
  | "network-error"
  | "slow";

export const MOCK_CONFIG: {
  mode: MockMode;
  delayMs: number;
  slowDelayMs: number;
} = {
  mode: "success",
  delayMs: 800,
  slowDelayMs: 3500,
};

// =========================================================
// Types — shared with the real API so swapping is type-safe
// =========================================================

export interface ApiOk<T> {
  ok: true;
  data: T;
}
export interface ApiErr {
  ok: false;
  error: {
    message: string;
    fieldErrors?: Record<string, string>;
  };
}
export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface CreateAccountResponse {
  id: string;
  createdAt: string;
}

// =========================================================
// Impl
// =========================================================

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function createAccount(
  _values: Values,
): Promise<ApiResult<CreateAccountResponse>> {
  const { mode, delayMs, slowDelayMs } = MOCK_CONFIG;
  const delay = mode === "slow" ? slowDelayMs : delayMs;
  await sleep(delay);

  switch (mode) {
    case "network-error":
      throw new Error("Network error: failed to reach server");

    case "server-error":
      return {
        ok: false,
        error: { message: "Server error (500). Please try again." },
      };

    case "field-error":
      return {
        ok: false,
        error: {
          message: "Some fields need attention.",
          fieldErrors: {
            email: "This email is already registered.",
          },
        },
      };

    case "success":
    case "slow":
    default:
      return {
        ok: true,
        data: {
          id: "usr_" + Math.random().toString(36).slice(2, 12),
          createdAt: new Date().toISOString(),
        },
      };
  }
}
