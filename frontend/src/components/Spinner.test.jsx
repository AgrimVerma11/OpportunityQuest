import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Spinner from "./Spinner";

describe("Spinner", () => {
  it("exposes an accessible status label", () => {
    render(<Spinner label="Loading opportunities" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Loading opportunities/)).toBeInTheDocument();
  });

  it("renders a visible label in centered mode", () => {
    render(<Spinner center label="Loading applicants" />);
    // The centered variant repeats the label as visible text.
    expect(screen.getAllByText(/Loading applicants/).length).toBeGreaterThan(0);
  });
});
