// Vitest setup: register jest-dom matchers on Vitest's expect and unmount
// React trees between tests (we run without `globals`, so cleanup is explicit).
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
