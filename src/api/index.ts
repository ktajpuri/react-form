import { createAccount as mockCreateAccount } from "./mockApi";
import { createAccount as realCreateAccount } from "./realApi";

export type {
  ApiOk,
  ApiErr,
  ApiResult,
  CreateAccountResponse,
  MockMode,
} from "./mockApi";

// Both implementations are bundled. The active one is picked at module
// initialization time based on `VITE_USE_MOCK_API`.
//
// Default (no env var, or "true") → mock. Set VITE_USE_MOCK_API=false to use
// the real API. In test, `import.meta.env` is undefined → defaults to mock.

const env = (import.meta as ImportMeta).env;
const useMock = !env || env.VITE_USE_MOCK_API !== "false";

export const createAccount = useMock ? mockCreateAccount : realCreateAccount;

export const USING_MOCK_API = useMock;
