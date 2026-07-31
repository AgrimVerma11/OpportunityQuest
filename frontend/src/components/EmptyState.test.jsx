import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renders a heading, description and action", () => {
    render(
      <EmptyState
        title="No opportunities found"
        description="Try changing your filters."
        action={<button>Clear filters</button>}
      />
    );
    expect(
      screen.getByRole("heading", { name: "No opportunities found" })
    ).toBeInTheDocument();
    expect(screen.getByText("Try changing your filters.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear filters" })
    ).toBeInTheDocument();
  });
});
