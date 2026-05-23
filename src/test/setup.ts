import "@testing-library/jest-dom/vitest";

// Signal to React that this environment supports act(); silences testing warnings.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
