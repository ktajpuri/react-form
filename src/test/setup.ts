import "@testing-library/jest-dom/vitest";

// Signal to React that this environment supports act(); silences testing warnings.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom does not implement scrollIntoView — stub it so productions calls
// from Form/store don't throw during tests, and so tests can spy on it.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
